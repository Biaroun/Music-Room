import { ImageSourcePropType } from 'react-native';

// set d'avatars predefinis (images bundlees).
// les images vivent dans mobile/assets/avatars/ (ici en .jpg).
// en react native chaque image doit etre require() en dur, pas de chemin dynamique,
// et l'extension doit correspondre exactement au fichier (.jpg = .jpeg = .png).
export type Avatar = { id: string; source: ImageSourcePropType };

// the 8 avatars (same ids as the backend)
export const AVATARS: Avatar[] = [
  { id: 'avatar-1', source: require('../../assets/avatars/avatar-1.jpg') },
  { id: 'avatar-2', source: require('../../assets/avatars/avatar-2.jpg') },
  { id: 'avatar-3', source: require('../../assets/avatars/avatar-3.jpg') },
  { id: 'avatar-4', source: require('../../assets/avatars/avatar-4.jpg') },
  { id: 'avatar-5', source: require('../../assets/avatars/avatar-5.jpg') },
  { id: 'avatar-6', source: require('../../assets/avatars/avatar-6.jpg') },
  { id: 'avatar-7', source: require('../../assets/avatars/avatar-7.jpg') },
  { id: 'avatar-8', source: require('../../assets/avatars/avatar-8.jpg') },
];

// find an avatar by id (null if unknown or no avatar)
export const getAvatar = (id?: string | null): Avatar | null =>
  AVATARS.find((a) => a.id === id) ?? null;
