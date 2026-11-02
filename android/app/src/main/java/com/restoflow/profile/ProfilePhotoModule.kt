package com.restoflow.profile

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ImageDecoder
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Rect
import android.media.ExifInterface
import android.net.Uri
import android.os.Build
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.UUID
import java.util.concurrent.Executors
import kotlin.math.roundToInt

class ProfilePhotoPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(ProfilePhotoModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}

class ProfilePhotoModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val worker = Executors.newSingleThreadExecutor()
  private val directory get() = File(context.cacheDir, "profile-photos").apply { mkdirs() }

  override fun getName() = "ProfilePhoto"

  private fun decode(uri: Uri): Bitmap {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      // ImageDecoder applies EXIF rotation/mirroring, including HEIC images.
      return ImageDecoder.decodeBitmap(ImageDecoder.createSource(context.contentResolver, uri)) { decoder, info, _ ->
        decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
        val scale = minOf(1.0, 1024.0 / maxOf(info.size.width, info.size.height))
        decoder.setTargetSize(maxOf(1, (info.size.width * scale).roundToInt()), maxOf(1, (info.size.height * scale).roundToInt()))
      }
    }
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    context.contentResolver.openInputStream(uri).use { BitmapFactory.decodeStream(it, null, bounds) }
    require(bounds.outWidth > 0 && bounds.outHeight > 0)
    val options = BitmapFactory.Options().apply { inSampleSize = 1 }
    while (maxOf(bounds.outWidth, bounds.outHeight) / options.inSampleSize > 1024) options.inSampleSize *= 2
    val bitmap = context.contentResolver.openInputStream(uri).use {
      requireNotNull(BitmapFactory.decodeStream(it, null, options))
    }
    val orientation = runCatching { context.contentResolver.openInputStream(uri).use {
      ExifInterface(requireNotNull(it)).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
    } }.getOrDefault(ExifInterface.ORIENTATION_NORMAL)
    val transform = Matrix().apply {
      when (orientation) {
        ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> setScale(-1f, 1f)
        ExifInterface.ORIENTATION_ROTATE_180 -> setRotate(180f)
        ExifInterface.ORIENTATION_FLIP_VERTICAL -> setScale(1f, -1f)
        ExifInterface.ORIENTATION_TRANSPOSE -> { setRotate(90f); postScale(-1f, 1f) }
        ExifInterface.ORIENTATION_ROTATE_90 -> setRotate(90f)
        ExifInterface.ORIENTATION_TRANSVERSE -> { setRotate(-90f); postScale(-1f, 1f) }
        ExifInterface.ORIENTATION_ROTATE_270 -> setRotate(-90f)
      }
    }
    val oriented = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, transform, true)
    if (oriented !== bitmap) bitmap.recycle()
    return oriented
  }

  @ReactMethod fun prepare(value: String, promise: Promise) {
    worker.execute {
      var source: Bitmap? = null
      var output: Bitmap? = null
      var file: File? = null
      try {
        val uri = Uri.parse(value)
        require(uri.scheme == "file" || uri.scheme == "content")
        // Expire abandoned drafts without touching photos still being edited.
        directory.listFiles()?.filter { System.currentTimeMillis() - it.lastModified() > 24 * 60 * 60 * 1000L }?.forEach { it.delete() }
        val decoded = decode(uri)
        source = decoded
        val square = Bitmap.createBitmap(SIZE, SIZE, Bitmap.Config.ARGB_8888)
        output = square
        val edge = minOf(decoded.width, decoded.height)
        val left = (decoded.width - edge) / 2
        val top = (decoded.height - edge) / 2
        Canvas(square).apply {
          drawColor(Color.WHITE)
          drawBitmap(decoded, Rect(left, top, left + edge, top + edge), Rect(0, 0, SIZE, SIZE), Paint(Paint.FILTER_BITMAP_FLAG))
        }
        val bytes = ByteArrayOutputStream()
        for (quality in listOf(80, 70, 60, 50, 40)) {
          bytes.reset()
          check(square.compress(Bitmap.CompressFormat.JPEG, quality, bytes))
          if (bytes.size() <= MAX_BYTES) break
        }
        check(bytes.size() in 1..MAX_BYTES)
        val destination = File(directory, "${UUID.randomUUID()}.jpg")
        file = destination
        destination.outputStream().use { bytes.writeTo(it) }
        promise.resolve(Arguments.createMap().apply {
          putString("uri", Uri.fromFile(destination).toString())
          putString("type", "image/jpeg")
          putString("name", "profile.jpg")
          putInt("width", SIZE)
          putInt("height", SIZE)
          putInt("fileSize", bytes.size())
        })
      } catch (error: Exception) {
        file?.delete()
        promise.reject("PROFILE_PHOTO", "The photo could not be prepared.", error)
      } finally {
        source?.recycle()
        output?.recycle()
      }
    }
  }

  @ReactMethod fun remove(value: String, promise: Promise) {
    worker.execute {
      try {
        val uri = Uri.parse(value)
        require(uri.scheme == "file")
        val file = File(requireNotNull(uri.path)).canonicalFile
        require(file.parentFile == directory.canonicalFile)
        file.delete()
        promise.resolve(null)
      } catch (error: Exception) {
        promise.reject("PROFILE_PHOTO", "The photo could not be removed.", error)
      }
    }
  }

  override fun invalidate() {
    worker.shutdown()
    super.invalidate()
  }

  companion object {
    const val SIZE = 256
    const val MAX_BYTES = 64 * 1024
  }
}
