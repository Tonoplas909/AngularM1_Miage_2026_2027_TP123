/*
 * Contraintes recopiées volontairement depuis le backend (`backend/src/app.js` :
 * MAX_FILE_SIZE et le Set `allowed` utilisé par le `fileFilter` de Multer).
 *
 * Cette duplication sert UNIQUEMENT à donner un retour immédiat à l'utilisateur
 * avant de consommer sa bande passante. Elle ne remplace jamais la validation
 * serveur : n'importe qui peut appeler l'API sans passer par cette application
 * (curl, Postman, code JavaScript modifié dans le navigateur). Le serveur reste
 * donc le seul juge, et il refuse de son côté avec un 400.
 */

/** 25 Mo, identique à `MAX_FILE_SIZE` côté backend. */
export const MAX_AUDIO_SIZE = 25 * 1024 * 1024;

/** Types MIME acceptés par le `fileFilter` de Multer. */
export const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
];

/** Extensions de secours : certains navigateurs ne renseignent pas `File.type`. */
const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a'];

/** Affiche une taille en octets sous une forme lisible (1,4 Mo). */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/** Traduit un type MIME en nom de format court affichable dans une card. */
export function formatAudioType(mimeType: string): string {
  switch (mimeType) {
    case 'audio/mpeg':
      return 'MP3';
    case 'audio/wav':
    case 'audio/x-wav':
      return 'WAV';
    case 'audio/ogg':
      return 'OGG';
    case 'audio/mp4':
    case 'audio/x-m4a':
      return 'M4A';
    default:
      return mimeType;
  }
}

/**
 * Renvoie un message d'erreur lisible, ou `null` si le fichier est acceptable.
 * Les mêmes règles que le backend sont vérifiées : présence, format, taille.
 */
export function validateAudioFile(file: File | undefined): string | null {
  if (!file) return 'Choisissez un fichier audio.';

  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  const typeIsKnown = file.type !== '';
  const accepted = typeIsKnown
    ? ALLOWED_AUDIO_TYPES.includes(file.type)
    : ALLOWED_EXTENSIONS.includes(extension);

  if (!accepted) {
    return `Format non accepté (${file.type || extension || 'inconnu'}). Formats autorisés : MP3, WAV, OGG, M4A.`;
  }

  if (file.size > MAX_AUDIO_SIZE) {
    return `Fichier trop volumineux (${formatSize(file.size)}). Maximum autorisé : ${formatSize(MAX_AUDIO_SIZE)}.`;
  }

  return null;
}
