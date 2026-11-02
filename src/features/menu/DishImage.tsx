import React, { useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import { artworkCategory, getCategoryArtwork } from './categoryArtwork';

// Legacy illustration: URIs and unsupported schemes are UI defaults, never photos.
export function dishPhotoUri(uri?: string | null) {
  const value = uri?.trim();
  if (!value || /\.svg(?:[?#]|$)/i.test(value)) return undefined;
  return /^https?:\/\/[^/\s?#]+(?:[/?#][^\r\n]*)?$/i.test(value) ||
    /^(?:file|content|ph|assets-library):\/\/[^\r\n]+$/i.test(value) ||
    /^data:image\/(?:jpeg|png|webp);base64,[a-z\d+/=]+$/i.test(value)
    ? value
    : undefined;
}

export function DishImage({
  uri,
  category,
}: {
  uri?: string | null;
  category?: string | null;
}) {
  const photo = dishPhotoUri(uri);
  // Remount on source changes, including A -> B -> A after A failed.
  return (
    <DishImageSource key={photo ?? 'artwork'} uri={photo} category={category} />
  );
}

function DishImageSource({
  uri,
  category,
}: {
  uri?: string;
  category?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const Artwork = getCategoryArtwork(category);
  return uri && !failed ? (
    <Image
      source={{ uri }}
      style={styles.image}
      resizeMode="cover"
      onError={() => setFailed(true)}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  ) : (
    <Artwork
      testID={`dish-artwork-${artworkCategory(category)}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', height: '100%' },
});
