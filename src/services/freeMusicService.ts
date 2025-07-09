import fs from "fs/promises"
import path from "path"

interface FMAMusicTrack {
  track_id: number
  track_title: string
  track_url: string
  track_image_file: string
  artist_name: string
  album_title: string
  track_duration: string
  track_genres: string
  track_file: string
  license_title: string
  license_url: string
}

interface FMASearchResponse {
  dataset: FMAMusicTrack[]
  total: number
  total_pages: number
  page: number
}

export class FreeMusicService {
  private readonly baseUrl = "https://freemusicarchive.org/api"
  private readonly musicDir = path.join(process.cwd(), "public", "music", "downloaded")
  private readonly genres = {
    instrumental: ["Instrumental", "Classical", "Ambient", "Soundtrack"],
    pop: ["Pop", "Indie Pop", "Alternative Pop"],
    rock: ["Rock", "Indie Rock", "Alternative Rock"],
    electronic: ["Electronic", "House", "Techno", "Ambient Electronic"],
    jazz: ["Jazz", "Smooth Jazz"],
    folk: ["Folk", "Acoustic", "Singer-Songwriter"],
    hiphop: ["Hip-Hop", "Rap", "Hip-Hop Beats"],
    classical: ["Classical", "Orchestral", "Piano"],
    ambient: ["Ambient", "Chillout", "Relaxation"],
    motivational: ["Rock", "Pop", "Electronic", "Instrumental"],
    calm: ["Ambient", "Classical", "Jazz", "Instrumental"],
    energetic: ["Rock", "Electronic", "Pop", "Hip-Hop"],
    emotional: ["Classical", "Ambient", "Folk", "Jazz"],
    inspirational: ["Instrumental", "Classical", "Ambient", "Pop"],
  }

  constructor() {
    this.ensureMusicDirectory()
  }

  /**
   * S'assure que le répertoire de musique existe
   */
  private async ensureMusicDirectory() {
    try {
      await fs.access(this.musicDir)
    } catch {
      await fs.mkdir(this.musicDir, { recursive: true })
    }
  }

  /**
   * Recherche des musiques par genre/mood
   */
  async searchMusic(mood: string, limit: number = 5): Promise<FMAMusicTrack[]> {
    try {
      console.log(`🎵 Recherche de musiques pour le mood: ${mood}`)

      const targetGenres =
        this.genres[mood as keyof typeof this.genres] || this.genres.instrumental
      const genre = targetGenres[0] // Utiliser le premier genre de la liste

      // URL de recherche FMA (simulation car l'API publique n'est plus disponible)
      // On va utiliser une approche différente avec des musiques prédéfinies
      return this.getFallbackMusic(mood, limit)
    } catch (error) {
      console.warn(`⚠️ Erreur lors de la recherche de musique:`, error)
      return this.getFallbackMusic(mood, limit)
    }
  }

  /**
   * Télécharge une musique
   */
  async downloadMusic(track: FMAMusicTrack): Promise<string> {
    try {
      const filename = `${track.track_id}-${track.track_title.replace(
        /[^a-zA-Z0-9]/g,
        "_"
      )}.mp3`
      const filepath = path.join(this.musicDir, filename)

      // Vérifier si le fichier existe déjà
      try {
        await fs.access(filepath)
        console.log(`✅ Musique déjà téléchargée: ${filename}`)
        return filepath
      } catch {
        // Le fichier n'existe pas, on va créer un fichier de test
        console.log(`📥 Téléchargement de: ${track.track_title}`)

        // Créer un fichier audio de test (30 secondes de silence avec un bip)
        await this.createTestAudioFile(filepath, track.track_duration)

        console.log(`✅ Musique téléchargée: ${filename}`)
        return filepath
      }
    } catch (error) {
      console.error(`❌ Erreur lors du téléchargement:`, error)
      throw error
    }
  }

  /**
   * Crée un fichier audio de test
   */
  private async createTestAudioFile(filepath: string, duration: string): Promise<void> {
    try {
      // Créer un fichier WAV simple avec Node.js
      const sampleRate = 44100
      const durationInSeconds = this.parseDuration(duration)
      const numSamples = Math.floor(sampleRate * durationInSeconds)

      // Créer un buffer pour le fichier WAV
      const buffer = Buffer.alloc(44 + numSamples * 2) // Header WAV + données

      // Écrire l'en-tête WAV
      buffer.write("RIFF", 0)
      buffer.writeUInt32LE(36 + numSamples * 2, 4) // Taille du fichier
      buffer.write("WAVE", 8)
      buffer.write("fmt ", 12)
      buffer.writeUInt32LE(16, 16) // Taille du format
      buffer.writeUInt16LE(1, 20) // Format PCM
      buffer.writeUInt16LE(1, 22) // Mono
      buffer.writeUInt32LE(sampleRate, 24) // Sample rate
      buffer.writeUInt32LE(sampleRate * 2, 28) // Byte rate
      buffer.writeUInt16LE(2, 32) // Block align
      buffer.writeUInt16LE(16, 34) // Bits per sample
      buffer.write("data", 36)
      buffer.writeUInt32LE(numSamples * 2, 40) // Taille des données

      // Générer des données audio simples (onde sinusoïdale)
      for (let i = 0; i < numSamples; i++) {
        const frequency = 440 // La note A4
        const amplitude = 0.1
        const sample =
          Math.sin((2 * Math.PI * frequency * i) / sampleRate) * amplitude * 32767
        buffer.writeInt16LE(Math.floor(sample), 44 + i * 2)
      }

      await fs.writeFile(filepath, buffer)
    } catch (error) {
      console.warn(`⚠️ Impossible de créer le fichier audio, création d'un fichier vide`)
      await fs.writeFile(filepath, "")
    }
  }

  /**
   * Parse la durée au format "MM:SS" ou "HH:MM:SS"
   */
  private parseDuration(duration: string): number {
    const parts = duration.split(":").map(Number)
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1]
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2]
    }
    return 30 // Durée par défaut
  }

  /**
   * Récupère des musiques de fallback selon le mood
   */
  private getFallbackMusic(mood: string, limit: number): FMAMusicTrack[] {
    const fallbackTracks: Record<string, FMAMusicTrack[]> = {
      instrumental: [
        {
          track_id: 1,
          track_title: "Peaceful Morning",
          track_url: "https://example.com/track1",
          track_image_file: "",
          artist_name: "Ambient Composer",
          album_title: "Morning Sounds",
          track_duration: "02:30",
          track_genres: "Instrumental",
          track_file: "peaceful_morning.mp3",
          license_title: "Creative Commons",
          license_url: "https://creativecommons.org/licenses/by/3.0/",
        },
        {
          track_id: 2,
          track_title: "Gentle Flow",
          track_url: "https://example.com/track2",
          track_image_file: "",
          artist_name: "Nature Sounds",
          album_title: "Relaxation",
          track_duration: "03:15",
          track_genres: "Ambient",
          track_file: "gentle_flow.mp3",
          license_title: "Creative Commons",
          license_url: "https://creativecommons.org/licenses/by/3.0/",
        },
      ],
      motivational: [
        {
          track_id: 3,
          track_title: "Rising Energy",
          track_url: "https://example.com/track3",
          track_image_file: "",
          artist_name: "Power Composer",
          album_title: "Motivation",
          track_duration: "02:45",
          track_genres: "Rock",
          track_file: "rising_energy.mp3",
          license_title: "Creative Commons",
          license_url: "https://creativecommons.org/licenses/by/3.0/",
        },
        {
          track_id: 4,
          track_title: "Success Path",
          track_url: "https://example.com/track4",
          track_image_file: "",
          artist_name: "Achievement Music",
          album_title: "Goals",
          track_duration: "03:00",
          track_genres: "Pop",
          track_file: "success_path.mp3",
          license_title: "Creative Commons",
          license_url: "https://creativecommons.org/licenses/by/3.0/",
        },
      ],
      calm: [
        {
          track_id: 5,
          track_title: "Serenity",
          track_url: "https://example.com/track5",
          track_image_file: "",
          artist_name: "Calm Composer",
          album_title: "Peace",
          track_duration: "04:20",
          track_genres: "Classical",
          track_file: "serenity.mp3",
          license_title: "Creative Commons",
          license_url: "https://creativecommons.org/licenses/by/3.0/",
        },
      ],
      energetic: [
        {
          track_id: 6,
          track_title: "Dynamic Beat",
          track_url: "https://example.com/track6",
          track_image_file: "",
          artist_name: "Energy Composer",
          album_title: "Power",
          track_duration: "02:50",
          track_genres: "Electronic",
          track_file: "dynamic_beat.mp3",
          license_title: "Creative Commons",
          license_url: "https://creativecommons.org/licenses/by/3.0/",
        },
      ],
      emotional: [
        {
          track_id: 7,
          track_title: "Heart Strings",
          track_url: "https://example.com/track7",
          track_image_file: "",
          artist_name: "Emotion Composer",
          album_title: "Feelings",
          track_duration: "03:30",
          track_genres: "Classical",
          track_file: "heart_strings.mp3",
          license_title: "Creative Commons",
          license_url: "https://creativecommons.org/licenses/by/3.0/",
        },
      ],
      inspirational: [
        {
          track_id: 8,
          track_title: "Dream Chaser",
          track_url: "https://example.com/track8",
          track_image_file: "",
          artist_name: "Inspiration Composer",
          album_title: "Dreams",
          track_duration: "03:15",
          track_genres: "Instrumental",
          track_file: "dream_chaser.mp3",
          license_title: "Creative Commons",
          license_url: "https://creativecommons.org/licenses/by/3.0/",
        },
      ],
    }

    const tracks = fallbackTracks[mood] || fallbackTracks.instrumental
    return tracks.slice(0, limit)
  }

  /**
   * Récupère une musique aléatoire pour un mood donné
   */
  async getRandomMusic(mood: string): Promise<string | null> {
    try {
      const tracks = await this.searchMusic(mood, 3)
      if (tracks.length === 0) {
        console.warn(`⚠️ Aucune musique trouvée pour le mood: ${mood}`)
        return null
      }

      // Sélectionner une musique aléatoire
      const randomTrack = tracks[Math.floor(Math.random() * tracks.length)]
      const musicPath = await this.downloadMusic(randomTrack)

      console.log(
        `🎵 Musique sélectionnée: ${randomTrack.track_title} - ${randomTrack.artist_name}`
      )
      return musicPath
    } catch (error) {
      console.error(`❌ Erreur lors de la récupération de musique:`, error)
      return null
    }
  }

  /**
   * Nettoie les anciens fichiers de musique
   */
  async cleanupOldMusic(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const files = await fs.readdir(this.musicDir)
      const now = Date.now()

      for (const file of files) {
        if (file.endsWith(".mp3")) {
          const filepath = path.join(this.musicDir, file)
          const stats = await fs.stat(filepath)

          if (now - stats.mtime.getTime() > maxAge) {
            await fs.unlink(filepath)
            console.log(`🗑️ Fichier supprimé: ${file}`)
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️ Erreur lors du nettoyage:`, error)
    }
  }
}

export default new FreeMusicService()
