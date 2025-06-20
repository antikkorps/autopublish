import bcrypt from "bcryptjs"
import { DataTypes, Model, Optional } from "sequelize"
import sequelize from "../config/database"

interface UserAttributes {
  id: number
  email: string
  password: string
  name: string
  role: "admin" | "user"
  isActive: boolean
  lastLogin?: Date
  apiKey?: string
  rateLimit: {
    daily: number
    hourly: number
  }
  createdAt: Date
  updatedAt: Date
}

interface UserCreationAttributes
  extends Optional<
    UserAttributes,
    "id" | "lastLogin" | "apiKey" | "createdAt" | "updatedAt"
  > {}

class User
  extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes
{
  // Déclarations avec 'declare' pour éviter le warning Sequelize
  // tout en gardant le typage TypeScript
  declare id: number
  declare email: string
  declare password: string
  declare name: string
  declare role: "admin" | "user"
  declare isActive: boolean
  declare lastLogin?: Date
  declare apiKey?: string
  declare rateLimit: {
    daily: number
    hourly: number
  }
  declare readonly createdAt: Date
  declare readonly updatedAt: Date

  // Méthodes d'instance
  public async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password)
  }

  public async updateLastLogin(): Promise<void> {
    this.lastLogin = new Date()
    await this.save()
  }

  public toSafeJSON() {
    const { password, apiKey, ...safeUser } = this.toJSON()
    return safeUser
  }

  // Méthodes statiques
  public static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12
    return bcrypt.hash(password, saltRounds)
  }

  public static async findByEmail(email: string): Promise<User | null> {
    return this.findOne({ where: { email: email.toLowerCase() } })
  }

  public static generateApiKey(): string {
    return "ak_" + Math.random().toString(36).substring(2) + Date.now().toString(36)
  }
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        len: [5, 255],
      },
      set(value: string) {
        this.setDataValue("email", value.toLowerCase().trim())
      },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: [8, 255], // Minimum 8 caractères
      },
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [2, 100],
        notEmpty: true,
      },
    },
    role: {
      type: DataTypes.ENUM("admin", "user"),
      allowNull: false,
      defaultValue: "user",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    apiKey: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true,
    },
    rateLimit: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {
        daily: 100, // 100 requêtes par jour pour les users normaux
        hourly: 20, // 20 requêtes par heure
      },
      validate: {
        isValidRateLimit(value: any) {
          if (!value || typeof value !== "object") {
            throw new Error("rateLimit doit être un objet")
          }
          if (!value.daily || !value.hourly) {
            throw new Error("rateLimit doit contenir daily et hourly")
          }
          if (value.daily < 1 || value.hourly < 1) {
            throw new Error("Les limites doivent être positives")
          }
        },
      },
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "users",
    timestamps: true,
    indexes: [
      {
        fields: ["email"],
        unique: true,
      },
      {
        fields: ["apiKey"],
        unique: true,
      },
      {
        fields: ["role"],
      },
      {
        fields: ["isActive"],
      },
    ],
    hooks: {
      beforeCreate: async (user: User) => {
        if (user.password) {
          user.password = await User.hashPassword(user.password)
        }
      },
      beforeUpdate: async (user: User) => {
        if (user.changed("password")) {
          user.password = await User.hashPassword(user.password)
        }
      },
    },
  }
)

export default User
