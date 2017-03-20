const Document = require('./document')

class Model {
	constructor() {
		this.sources = []
		this.boundSources = []
		this.mutations = []
		this.queries = []
		this.initializers = []
		this.dataMap = data => data
	}

	/**
	 * Create a new model
	 * 
	 * @static
	 * @returns {Model}
	 * 
	 * @memberOf Model
	 */
	static create() {
		return new Model()
	}

	/**
	 * Add a source to the model
	 * 
	 * Souces are used to populate data into the model. A source can either be
	 * a single Schema, or [Schema] to denote that multipe records should
	 * be pulled from the schema.
	 * 
	 * @param {String} name 
	 * @param {Schema|Schema[]} schema
	 * @returns {Model}
	 * 
	 * @memberOf Model
	 */
	addSource(name, schema) {
		const many = Array.isArray(schema)

		this.sources.push({ name, schema: many ? schema[0] : schema, many })
		return this
	}

	/**
	 * Add a bound source
	 * 
	 * A bound source is a source that can delete its records
	 * 
	 * @param {String} name 
	 * @param {Schema|Schema[]} schema 
	 * @returns {Model}
	 * 
	 * @memberOf Model
	 */
	addBoundSource(name, ...args) {
		this.addSource.apply(this, [name, ...args])
		this.boundSources.push(name)
		return this
	}

	/**
	 * Add a mutation
	 * 
	 * A mutation is a method used to change the source data in some way.
	 * It is the only means of updating data in the model.
	 * 
	 * The `fn` parameter is a function that will receive the input data,
	 * and the currently available document data. It should return an array
	 * 
	 * **Example**
	 * 
	 * ```javascript
	 * .addMutation('updateTitle', (title, data) => ([
	 * 		{ source: 'post', data: { title } }
	 * ])
	 * ```
	 * 
	 * @param {String} name 
	 * @param {Function} fn 
	 * @returns {Model}
	 * 
	 * @memberOf Model
	 */
	addMutation(name, fn) {
		this.mutations.push({ name, fn })
		return this
	}

	/**
	 * Add a new query
	 * 
	 * Queries allow data to be pulled into the model. They provide the
	 * source populations methods.
	 * 
	 * A query with the name 'default' is required.
	 * 
	 * @param {String} name 
	 * @param {Query} query 
	 * @returns {Model}
	 * 
	 * @memberOf Model
	 */
	addQuery(name, query) {
		this.queries.push({ name, query })
		return this
	}

	/**
	 * Add a source initializer
	 * 
	 * Initializers are used to create new source records. When using
	 * `Model.create()`, initializers are executed in the order in which
	 * the sources are populated in the default query.
	 * 
	 * The `init` parameter is a function that will receive the input data,
	 * and the currently available document data. It should return a query
	 * in whatever form the data store requires.
	 * 
	 * **Example**
	 * 
	 * ```javascript
	 * .addInitializer('post', (postData, data) => ({
	 * 		title: data.title,
	 * 		content: data.content
	 * }))
	 * ```
	 * 
	 * @param {String} sourceName 
	 * @param {Function} init 
	 * @returns {Model}
	 * 
	 * @memberOf Model
	 */
	addInitializer(sourceName, init) {
		this.initializers.push({ source: sourceName, init })
		return this
	}

	/**
	 * Add sources to be bound
	 * 
	 * @param {String[]} sourceNames 
	 * @returns {Model}
	 * 
	 * @memberOf Model
	 */
	bindSources(sourceNames) {
		this.boundSources = this.boundSources.concat(sourceNames)
		return this
	}

	/**
	 * Add the source map
	 * 
	 * This is a function that should map the data from the
	 * sources to a final model document.
	 * 
	 * If not defined, all source data is passed to the document.
	 * 
	 * **Example**
	 * 
	 * ```javascript
	 * .map(data => ({
	 * 		title: data.post.title,
	 * 		content: data.post.content,
	 * 		foo: 'bar'
	 * }))
	 * ```
	 * 
	 * @param {Function} dataMap 
	 * @returns {Model}
	 * 
	 * @memberOf Model
	 */
	map(dataMap) {
		this.dataMap = dataMap
		return this
	}

	/**
	 * Execute a query
	 * 
	 * If the query is configured as `multi`, this will return
	 * and array of Documents.
	 * 
	 * @param {String} queryName 
	 * @param {any} inputData 
	 * @returns {Document|Document[]}
	 * 
	 * @memberOf Model
	 */
	async query(queryName, inputData) {
		const query = this._getQuery(queryName)
		let rawData = query.inputs.toSource(inputData)

		for (const item of query.populations) {
			const source = this._getSource(item.source)
			const select = item.select(rawData)
			const sourceData = await this._readFromSchema(source.schema, select, source.many)
			rawData = { ...rawData, [source.name]: sourceData }
		}
		
		if (query.multi) {
			return query.dataMap(rawData).map(item => {
				return new Document(this, this.dataMap(item), inputData, queryName, item)
			})
		} else {
			return new Document(this, this.dataMap(rawData), inputData, queryName, rawData)
		}
	}

	/**
	 * Execute the default query
	 * 
	 * @param {any} input 
	 * @returns {Document|Document[]}
	 * 
	 * @memberOf Model
	 */
	async get(input) {
		return this.query('default', input)
	}

	/**
	 * Apply a mutation
	 * 
	 * @param {String} name 
	 * @param {any} queryInput 
	 * @param {String} queryName 
	 * @param {Object} data 
	 * @param {Object} docData 
	 * @returns {Document|Document[]}
	 * 
	 * @memberOf Model
	 */
	async mutate(name, queryInput, queryName, data, docData) {
		const query = this._getQuery(queryName || 'default')
		const mutation = this._getMutation(name)
		const inputData = query.inputs.toSource(queryInput)
		const sourceData = mutation.fn(data, docData)

		for (const item of sourceData) {
			const source = this._getSource(item.source)
			const population = query.populations.find(pop => pop.source === item.source)

			switch (item.operation) {
				case 'create':
					await source.schema.create(item.data)
					break
				case 'delete':
					await source.schema.del(item.data)
					break
				default:
					await source.schema.update(population.select(inputData), item.data)
			}
		}

		return this.query(queryName, queryInput)
	}

	/**
	 * Delete a document
	 * 
	 * Returns an array of objects with properties matching the name
	 * of the source from which records were deleted, and the deleted
	 * source records.
	 * 
	 * @param {any} queryInput 
	 * @param {String} queryName 
	 * @returns {Array}
	 * 
	 * @memberOf Model
	 */
	async del(queryInput, queryName) {
		const query = this._getQuery(queryName || 'default')
		const inputData = query.inputs.toSource(queryInput)
		const result = []

		for (const name of this.boundSources) {
			const source = this._getSource(name)
			const population = query.populations.find(pop => pop.source === name)
			const deleted = await source.schema.del(population.select(inputData))

			result.push({ source: name, deleted })
		}

		return result
	}

	/**
	 * Create a new model document
	 * 
	 * Execute each of the initializers and pass data through the default
	 * query.
	 * 
	 * @param {any} inputData 
	 * @returns {Document||Document[]}
	 * 
	 * @memberOf Model
	 */
	async create(inputData) {
		const query = this._getQuery('default')
		let rawData = {}
		let mappedData

		for (const item of query.populations) {
			const source = this._getSource(item.source)
			const initializer = this.initializers.find(i => i.source === item.source)
			let sourceData

			if (initializer) {
				sourceData = await this._createFromSchema(source.schema, initializer.init(inputData, rawData), source.many)
			} else {
				const select = item.select(rawData)
				sourceData = await this._readFromSchema(source.schema, select, source.many)
			}

			rawData = { ...rawData, [source.name]: sourceData }
		}
		
		mappedData = this.dataMap(rawData)

		return new Document(this, mappedData, query.inputs.fromSource(rawData), rawData)
	}

	_readFromSchema(schema, select, many) {
		if (Array.isArray(select)) {
			const promises = select.map(item => {
				return schema.read(item, !many)
			})

			return Promise.all(promises)
		}

		return schema.read(select, !many)
	}

	_createFromSchema(schema, data, many) {
		if (Array.isArray(data) && many) {
			const promises = data.map(item => {
				return schema.create(item)
			})

			return Promise.all(promises)
		}

		return schema.create(data)
	}

	_getSource(name) {
		return this.sources.find(source => source.name === name)
	}

	_getMutation(name) {
		return this.mutations.find(mutation => mutation.name === name)
	}

	_getQuery(name) {
		return this.queries.find(query => query.name === name).query
	}
}

module.exports = Model