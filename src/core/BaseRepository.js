/**
 * High-speed in-memory micro-cache for BaseRepository.
 * Caches read queries for 6 seconds and automatically purges whenever a model mutation occurs.
 */
class RepositoryCache {
  constructor(defaultTtlMs = 6000) {
    this.cache = new Map();
    this.defaultTtlMs = defaultTtlMs;
  }

  getKey(modelName, action, scopedFilter, options) {
    return `${modelName}:${action}:${JSON.stringify(scopedFilter)}:${JSON.stringify(options)}`;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value, modelName, ttlMs = this.defaultTtlMs) {
    if (this.cache.size > 2000) {
      const now = Date.now();
      for (const [k, v] of this.cache.entries()) {
        if (now > v.expiry) this.cache.delete(k);
      }
    }
    this.cache.set(key, {
      value,
      modelName,
      expiry: Date.now() + ttlMs,
    });
  }

  invalidate(modelName) {
    if (!modelName) return;
    for (const [k, v] of this.cache.entries()) {
      if (v.modelName === modelName) {
        this.cache.delete(k);
      }
    }
  }

  clear() {
    this.cache.clear();
  }
}

export const repoCache = new RepositoryCache(6000);

/**
 * Base Repository providing tenant-aware CRUD, caching, lean projection, and pagination for Mongoose models.
 */
export class BaseRepository {
  constructor(model) {
    this.model = model;
    this.modelName = model?.modelName || 'Model';
  }

  /**
   * Apply tenant filter automatically if tenantId is present in context
   */
  _scopeFilter(filter = {}, tenantId = null) {
    if (tenantId) {
      return { ...filter, tenantId };
    }
    return filter;
  }

  async create(data, options = {}) {
    repoCache.invalidate(this.modelName);
    const document = new this.model(data);
    return await document.save(options);
  }

  async findById(id, tenantId = null, options = {}) {
    const scoped = this._scopeFilter({ _id: id }, tenantId);
    const isLean = options.lean === true;

    // Fast-path in-memory micro-cache check for single lookups
    const cacheKey = repoCache.getKey(this.modelName, 'findById', scoped, options);
    if (isLean) {
      const cached = repoCache.get(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    let query = this.model.findOne(scoped);
    if (options.populate) query = query.populate(options.populate);
    if (options.select) query = query.select(options.select);
    if (isLean) query = query.lean();

    const result = await query.exec();
    if (result && isLean) {
      repoCache.set(cacheKey, result, this.modelName);
    }
    return result;
  }

  async findOne(filter = {}, tenantId = null, options = {}) {
    const scoped = this._scopeFilter(filter, tenantId);
    let query = this.model.findOne(scoped);
    if (options.populate) query = query.populate(options.populate);
    if (options.select) query = query.select(options.select);
    if (options.sort) query = query.sort(options.sort);
    if (options.lean === true) query = query.lean();
    return await query.exec();
  }

  async find(filter = {}, tenantId = null, options = {}) {
    const scoped = this._scopeFilter(filter, tenantId);
    let query = this.model.find(scoped);

    if (options.sort) query = query.sort(options.sort);
    if (options.limit) query = query.limit(options.limit);
    if (options.skip) query = query.skip(options.skip);
    if (options.populate) query = query.populate(options.populate);
    if (options.select) query = query.select(options.select);
    if (options.lean !== false) query = query.lean();

    return await query.exec();
  }

  async updateById(id, updateData, tenantId = null) {
    repoCache.invalidate(this.modelName);
    const filter = this._scopeFilter({ _id: id }, tenantId);
    return await this.model.findOneAndUpdate(filter, updateData, {
      new: true,
      runValidators: true,
    });
  }

  async deleteById(id, tenantId = null) {
    repoCache.invalidate(this.modelName);
    const filter = this._scopeFilter({ _id: id }, tenantId);
    return await this.model.findOneAndDelete(filter);
  }

  async count(filter = {}, tenantId = null) {
    const scoped = this._scopeFilter(filter, tenantId);
    return await this.model.countDocuments(scoped);
  }

  async paginate(filter = {}, { page = 1, limit = 20, sort = { createdAt: -1 }, populate = null, select = null, lean = true } = {}, tenantId = null) {
    const scoped = this._scopeFilter(filter, tenantId);
    const currentPage = Math.max(1, Number.parseInt(page, 10));
    const pageLimit = Math.min(200, Math.max(1, Number.parseInt(limit, 10)));
    const skip = (currentPage - 1) * pageLimit;

    // Fast-path in-memory cache check
    const cacheKey = repoCache.getKey(this.modelName, 'paginate', scoped, {
      page: currentPage,
      limit: pageLimit,
      sort,
      populate,
      select,
    });
    const cached = repoCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    let itemsQuery = this.model.find(scoped).sort(sort).skip(skip).limit(pageLimit);
    if (populate) itemsQuery = itemsQuery.populate(populate);
    if (select) itemsQuery = itemsQuery.select(select);
    if (lean !== false) itemsQuery = itemsQuery.lean();

    const [items, total] = await Promise.all([
      itemsQuery.exec(),
      this.model.countDocuments(scoped),
    ]);

    const result = {
      items,
      pagination: {
        page: currentPage,
        limit: pageLimit,
        total,
        totalPages: Math.ceil(total / pageLimit),
        hasNext: currentPage * pageLimit < total,
        hasPrev: currentPage > 1,
      },
    };

    repoCache.set(cacheKey, result, this.modelName);
    return result;
  }

  async findWithPagination(filter = {}, pagination = {}, options = {}, tenantId = null) {
    return await this.paginate(filter, { ...pagination, ...options }, tenantId);
  }
}
