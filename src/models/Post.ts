import { DataTypes, Model, Optional } from "sequelize"
import sequelize from "../config/database"

interface PostAttributes {
  id: number
  citation_id: number
  image_url: string
  image_path: string
  template_used: string
  instagram_post_id?: string
  status: "scheduled" | "published" | "failed" | "draft"
  scheduled_for: Date
  published_at?: Date
  caption: string
  hashtags: string[]
  engagement?: {
    likes?: number
    comments?: number
    shares?: number
    saves?: number
  }
  error_message?: string
  retry_count: number
  metadata?: object
}

interface PostCreationAttributes
  extends Optional<
    PostAttributes,
    | "id"
    | "instagram_post_id"
    | "published_at"
    | "engagement"
    | "error_message"
    | "retry_count"
    | "metadata"
  > {}

class Post
  extends Model<PostAttributes, PostCreationAttributes>
  implements PostAttributes
{
  // Déclarations avec 'declare' pour éviter le warning Sequelize
  declare id: number
  declare citation_id: number
  declare image_url: string
  declare image_path: string
  declare template_used: string
  declare instagram_post_id?: string
  declare status: "scheduled" | "published" | "failed" | "draft"
  declare scheduled_for: Date
  declare published_at?: Date
  declare caption: string
  declare hashtags: string[]
  declare engagement?: {
    likes?: number
    comments?: number
    shares?: number
    saves?: number
  }
  declare error_message?: string
  declare retry_count: number
  declare metadata?: object

  declare readonly createdAt: Date
  declare readonly updatedAt: Date
}

Post.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    citation_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "citations",
        key: "id",
      },
    },
    image_url: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    image_path: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    template_used: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    instagram_post_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true,
    },
    status: {
      type: DataTypes.ENUM("scheduled", "published", "failed", "draft"),
      allowNull: false,
      defaultValue: "draft",
    },
    scheduled_for: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    published_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    caption: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    hashtags: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    engagement: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    retry_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "posts",
    timestamps: true,
    indexes: [
      {
        fields: ["citation_id"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["scheduled_for"],
      },
      {
        fields: ["published_at"],
      },
    ],
  }
)

export default Post
