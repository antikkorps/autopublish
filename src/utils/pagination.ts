import { FindAndCountOptions, Model, WhereOptions } from "sequelize"

export interface PaginationOptions {
  page?: number
  limit?: number
  defaultLimit?: number
  maxLimit?: number
}

export interface PaginationResult<T> {
  data: T[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
    nextPage: number | null
    prevPage: number | null
  }
}

export interface PaginationQuery {
  page?: string | number
  limit?: string | number
  [key: string]: any
}

export class PaginationHelper {
  /**
   * Extrait et valide les paramètres de pagination depuis la query
   */
  static extractPaginationParams(
    query: PaginationQuery,
    options: PaginationOptions = {}
  ): {
    page: number
    limit: number
    offset: number
  } {
    const { defaultLimit = 10, maxLimit = 100 } = options

    let page = parseInt(String(query.page || 1))
    let limit = parseInt(String(query.limit || defaultLimit))

    // Validation des valeurs
    if (isNaN(page) || page < 1) page = 1
    if (isNaN(limit) || limit < 1) limit = defaultLimit
    if (limit > maxLimit) limit = maxLimit

    const offset = (page - 1) * limit

    return { page, limit, offset }
  }

  /**
   * Applique la pagination à une requête Sequelize
   */
  static async paginate<T extends Model>(
    model: any,
    query: PaginationQuery,
    findOptions: Omit<FindAndCountOptions, "limit" | "offset"> = {},
    paginationOptions: PaginationOptions = {}
  ): Promise<PaginationResult<T>> {
    const { page, limit, offset } = this.extractPaginationParams(query, paginationOptions)

    const { count, rows } = await model.findAndCountAll({
      ...findOptions,
      limit,
      offset,
      distinct: true, // Pour éviter les problèmes avec les JOIN
    })

    const totalPages = Math.ceil(count / limit)
    const hasNext = page < totalPages
    const hasPrev = page > 1

    return {
      data: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages,
        hasNext,
        hasPrev,
        nextPage: hasNext ? page + 1 : null,
        prevPage: hasPrev ? page - 1 : null,
      },
    }
  }

  /**
   * Crée les paramètres de pagination pour les liens d'API
   */
  static createPaginationLinks(
    baseUrl: string,
    pagination: PaginationResult<any>["pagination"],
    query: Record<string, any> = {}
  ): {
    self: string
    first: string
    last: string
    next: string | null
    prev: string | null
  } {
    const createUrl = (page: number) => {
      const params = new URLSearchParams({
        ...query,
        page: page.toString(),
        limit: pagination.limit.toString(),
      })
      return `${baseUrl}?${params.toString()}`
    }

    return {
      self: createUrl(pagination.page),
      first: createUrl(1),
      last: createUrl(pagination.totalPages),
      next: pagination.hasNext ? createUrl(pagination.nextPage!) : null,
      prev: pagination.hasPrev ? createUrl(pagination.prevPage!) : null,
    }
  }

  /**
   * Filtre les paramètres de query pour enlever la pagination
   */
  static filterQueryParams(
    query: Record<string, any>,
    excludeKeys: string[] = ["page", "limit"]
  ): Record<string, any> {
    const filtered: Record<string, any> = {}

    for (const [key, value] of Object.entries(query)) {
      if (!excludeKeys.includes(key) && value !== undefined && value !== "") {
        filtered[key] = value
      }
    }

    return filtered
  }

  /**
   * Construit une clause WHERE à partir des paramètres de query
   */
  static buildWhereClause(
    query: Record<string, any>,
    allowedFilters: string[]
  ): WhereOptions {
    const whereClause: WhereOptions = {}

    for (const field of allowedFilters) {
      if (query[field] !== undefined && query[field] !== "") {
        whereClause[field] = query[field]
      }
    }

    return whereClause
  }
}

/**
 * Décorateur pour faciliter l'usage de la pagination dans les contrôleurs
 */
export function paginated(options: PaginationOptions = {}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const ctx = args[0] // Premier argument est toujours le contexte Koa

      // Ajouter les options de pagination au contexte
      ctx.paginationOptions = options

      return method.apply(this, args)
    }
  }
}

export default PaginationHelper
