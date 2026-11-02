import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Image, NativeModules } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import '../src/localization/i18n';
import { Avatar } from '../src/components/Avatar';
import { useProfilePhoto } from '../src/hooks/useProfilePhoto';
import {
  prepareProfilePhoto,
  PROFILE_PHOTO_MAX_BYTES,
} from '../src/services/profilePhoto';

const native = NativeModules.ProfilePhoto;
const prepared = {
  uri: 'file:///cache/profile-photos/draft.jpg',
  name: 'profile.jpg',
  type: 'image/jpeg',
  width: 256,
  height: 256,
  fileSize: 12000,
};
let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
let hook: ReturnType<typeof useProfilePhoto>;
function Harness() {
  hook = useProfilePhoto();
  return null;
}
beforeEach(() => {
  native.prepare.mockReset().mockResolvedValue(prepared);
  native.remove.mockClear();
  jest
    .mocked(launchImageLibrary)
    .mockReset()
    .mockResolvedValue({ didCancel: true });
});
afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = undefined;
});
async function mount() {
  await act(async () => {
    renderer = ReactTestRenderer.create(<Harness />);
  });
}
async function select(uri = 'file:///original') {
  jest.mocked(launchImageLibrary).mockResolvedValue({ assets: [{ uri }] });
  await act(async () => hook.selectPhoto());
}

test.each(['image/jpg', 'image/png', 'image/heic', undefined])(
  'decodes %s selections and keeps only the compact JPEG draft',
  async type => {
    await mount();
    jest.mocked(launchImageLibrary).mockResolvedValue({
      assets: [
        { uri: 'file:///large-original', type, fileSize: 20 * 1024 * 1024 },
      ],
    });
    await act(async () => hook.selectPhoto());
    expect(native.prepare).toHaveBeenCalledWith('file:///large-original');
    expect(hook.photo).toEqual({
      uri: prepared.uri,
      type: 'image/jpeg',
      name: 'profile.jpg',
    });
    expect(hook.picking).toBe(false);
  },
);

test.each([
  { width: 512 },
  { height: 512 },
  { type: 'image/png' },
  { fileSize: PROFILE_PHOTO_MAX_BYTES + 1 },
  { fileSize: 0 },
  { fileSize: undefined },
  { uri: 'https://example.com/photo.jpg' },
])(
  'rejects an uncompressed or invalid native output %j before it can be uploaded',
  async invalid => {
    native.prepare.mockResolvedValue({ ...prepared, ...invalid });
    await expect(prepareProfilePhoto('file:///original')).rejects.toThrow(
      'The photo could not be prepared.',
    );
    expect(native.remove).toHaveBeenCalled();
  },
);

test('canceling or failing a replacement retains the previous prepared draft', async () => {
  await mount();
  await select();
  jest.mocked(launchImageLibrary).mockResolvedValue({ didCancel: true });
  await act(async () => hook.selectPhoto());
  expect(hook.photo?.uri).toBe(prepared.uri);
  native.prepare.mockRejectedValueOnce(new Error('Invalid image bytes'));
  await select('file:///invalid');
  expect(hook.photo?.uri).toBe(prepared.uri);
  expect(hook.picking).toBe(false);
  expect(native.remove).not.toHaveBeenCalledWith(prepared.uri);
});

test('replacing a draft and leaving the screen clean up only prepared files', async () => {
  await mount();
  await select('file:///original-one');
  const replacement = 'file:///cache/profile-photos/replacement.jpg';
  native.prepare.mockResolvedValue({ ...prepared, uri: replacement });
  await select('file:///original-two');
  expect(native.remove).toHaveBeenCalledWith(prepared.uri);
  expect(native.remove).not.toHaveBeenCalledWith('file:///original-one');
  await act(async () => renderer!.unmount());
  renderer = undefined;
  expect(native.remove).toHaveBeenCalledWith(replacement);
});

test('only one selection runs at a time and leaving during preparation removes its eventual output', async () => {
  let finish!: (value: typeof prepared) => void;
  native.prepare.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await mount();
  jest
    .mocked(launchImageLibrary)
    .mockResolvedValue({ assets: [{ uri: 'file:///original' }] });
  let pending!: Promise<void>;
  await act(async () => {
    pending = hook.selectPhoto();
  });
  expect(hook.picking).toBe(true);
  await act(async () => hook.selectPhoto());
  expect(launchImageLibrary).toHaveBeenCalledTimes(1);
  await act(async () => renderer!.unmount());
  renderer = undefined;
  await act(async () => {
    finish(prepared);
    await pending;
  });
  expect(native.remove).toHaveBeenCalledWith(prepared.uri);
});

test('an unreadable avatar falls back to initials and a new saved URL displays a fresh image', async () => {
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <Avatar name="Owner" photo="https://example.com/old.jpg" />,
    );
  });
  await act(async () => renderer!.root.findByType(Image).props.onError());
  expect(renderer!.root.findAllByType(Image)).toHaveLength(0);
  await act(async () =>
    renderer!.update(
      <Avatar name="Owner" photo="https://example.com/new.jpg" />,
    ),
  );
  expect(renderer!.root.findByType(Image).props.source).toEqual({
    uri: 'https://example.com/new.jpg',
  });
});
