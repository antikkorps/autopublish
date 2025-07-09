import { DataTypes, Model, Optional } from "sequelize"
import sequelize from "../config/database"

interface CitationAttributes {
  id: number
  content: string
  author?: string
  theme: string
  language: string
  quality_score: number
  status: "pending" | "approved" | "rejected" | "published"
  ai_source: "openai" | "claude"
  generated_at: Date
  validated_at?: Date
  published_at?: Date
  hashtags?: string[]
  metadata?: object
  imagePath?: string
  imageMetadata?: object
  videoPath?: string
  videoMetadata?: object
}

interface CitationCreationAttributes
  extends Optional<
    CitationAttributes,
    | "id"
    | "author"
    | "validated_at"
    | "published_at"
    | "hashtags"
    | "metadata"
    | "imagePath"
    | "imageMetadata"
    | "videoPath"
    | "videoMetadata"
  > {}

class Citation
  extends Model<CitationAttributes, CitationCreationAttributes>
  implements CitationAttributes
{
  // Déclarations avec 'declare' pour éviter le warning Sequelize
  declare id: number
  declare content: string
  declare author?: string
  declare theme: string
  declare language: string
  declare quality_score: number
  declare status: "pending" | "approved" | "rejected" | "published"
  declare ai_source: "openai" | "claude"
  declare generated_at: Date
  declare validated_at?: Date
  declare published_at?: Date
  declare hashtags?: string[]
  declare metadata?: object
  declare imagePath?: string
  declare imageMetadata?: object
  declare videoPath?: string
  declare videoMetadata?: object

  declare readonly createdAt: Date
  declare readonly updatedAt: Date
}

Citation.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [10, 2000], // Entre 10 et 2000 caractères
      },
    },
    author: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    theme: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        isIn: [
          [
            "motivation",
            "success",
            "love",
            "life",
            "wisdom",
            "happiness",
            "inspiration",
            "leadership",
            "mindfulness",
            "creativity",
            "parentalite",
            "education",
            "famille",
            "enfance",
          ],
        ],
      },
    },
    language: {
      type: DataTypes.STRING(5),
      allowNull: false,
      defaultValue: "fr",
      validate: {
        isIn: [["fr", "en", "es", "de", "it"]],
      },
    },
    quality_score: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 1,
      },
    },
    status: {
      type: DataTypes.ENUM("pending", "approved", "rejected", "published"),
      allowNull: false,
      defaultValue: "pending",
    },
    ai_source: {
      type: DataTypes.ENUM("openai", "claude"),
      allowNull: false,
    },
    generated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    validated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    published_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    hashtags: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    imagePath: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    imageMetadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    videoPath: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    videoMetadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "citations",
    timestamps: true,
    indexes: [
      {
        fields: ["theme"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["quality_score"],
      },
      {
        fields: ["generated_at"],
      },
    ],
  }
)

export default Citation
