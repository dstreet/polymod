const Document = require('./document')
const validator = require('./validator')

class Model {
	constructor() {
		this.sources = []
		this.boundSources = []
		this.mutations = {}
		this.queries = []
		this.initializers = []
		this.defaults = {}
		this.mutationSchema = {}
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
	 * Get or set the data description
	 * 
	 * @param {Object} [dataDescription]
	 * @returns {Object|Model}
	 * 
	 * @memberOf Model
	 */
	describe(dataDescription) {
		if (!dataDescription) {
			return Object.keys(this.dataDescription).reduce((acc, key) => ({
				...acc,
				[key]: {
					type: this.dataDescription[key].type,
					meta: this.dataDescription[key].meta,
					mutable: 'mutation' in this.dataDescription[key]
				}
			}), {})
		}

		this.dataDescription = dataDescription
		
		// Build a dataMap function from the data properties of each descriptor
		this.dataMap = data => Object.keys(dataDescription).reduce((acc, key) => ({
			...acc, [key]: dataDescription[key].data(data)
		}), {})

		// Store the mutations for each descriptor
		this.mutations = Object.keys(dataDescription).reduce((acc, key) => {
			if ('mutation' in dataDescription[key])	{
				return {
					...acc,
					[key]: {
						methods: [].concat(dataDescription[key].mutation.method),
						type: dataDescription[key].mutation.type || dataDescription[key].type
					}
				}
			}

			return acc
		}, this.mutations)

		this.defaults = Object.keys(dataDescription).reduce((acc, key) => {
			if ('default' in dataDescription[key]) {
				return { ...acc, [key]: dataDescription[key].default }
			}

			return acc
		}, {})

		this.mutationSchema = {
			type: 'object',
			properties: Object.keys(dataDescription).reduce((acc, key) => {
				let type

				if ('mutation' in dataDescription[key] && 'type' in dataDescription[key].mutation) {
					type = validator.parseType(dataDescription[key].mutation.type, dataDescription[key].required)
				} else {
					type = validator.parseType(dataDescription[key].type, dataDescription[key].required)
				}

				return { ...acc, [key]: type }
			}, {})
		}

		return this
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
	 * @param {Boolean} required
	 * @returns {Model}
	 * 
	 * @memberOf Model
	 */
	addSource(name, schema, required = true) {
		const many = Array.isArray(schema)

		this.sources.push({ name, schema: many ? schema[0] : schema, many, required })
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
	 * The `data` property is a function that will receive the input data,
	 * and the currently available document data.
	 * 
	 * **Example**
	 * 
	 * ```javascript
	 * .addMutation('updateTitle', [
	 * 		{ source: 'post', data: title => { title } }
	 * ], String)
	 * ```
	 * 
	 * @param {String} name 
	 * @param {Array|Object|Function} method 
	 * @param {Any} type
	 * @returns {Model}
	 * 
	 * @memberOf Model
	 */
	addMutation(name, method, type) {
		this.mutations[name] = {
			methods: [].concat(method),
			type: validator.parseType(type)
		}

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
			
			if (!sourceData && source.required) {
				return new Document(this, undefined, inputData, queryName, undefined)
			}

			rawData = { ...rawData, [source.name]: sourceData }
		}
		
		if (query.multi) {
			return query.dataMap(rawData).map(item => {
				return new Document(this, this.dataMap(item), inputData, queryName, item)
			})
		} else {
			try {
				return new Document(this, this.dataMap(rawData), inputData, queryName, rawData)
			} catch (e) {
				throw new Error('Failed to create document')
			}
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
	 * Apply mutations
	 * 
	 * @param {any} queryInput 
	 * @param {String} queryName 
	 * @param {Object} data 
	 * @param {Object} docData 
	 * @returns {Object}
	 * 
	 * @memberOf Model
	 */
	async mutate(queryInput, queryName, data, docData) {
		const query = this._getQuery(queryName || 'default')
		const inputData = query.inputs.toSource(queryInput)
		const dataWithDefaults = { ...this.defaults, ...data }
		const validatorResult = validator.validate(this.mutationSchema, dataWithDefaults)
		
		if (!validatorResult.valid) {
			return [
				undefined,
				{ err: new Error('Invalid'), data: validatorResult.error }
			]
		}

		const mutationData = this._getMutations(Object.keys(dataWithDefaults))
			// Group mutations by source and operation, and apply the data function
			// This enables the ability to send a single query to the source schema when
			// multiple properties are being edited.
			.reduce((acc, item) => {
				const source = item.source
				const operation = item.operation || 'update'
				const itemData = item.data(data[item.property], docData)

				if (source in acc) {
					return {
						...acc,
						[source]: {
							...acc[source],
							[operation]: acc[source][operation] ?
								{...acc[source][operation], ...itemData} :
								itemData
						}
					}
				} else {
					return {
						...acc,
						[source]: {
							[operation]: itemData
						}
					}
				}
			}, {})

		for (const sourceName of Object.keys(mutationData)) {
			const source = this._getSource(sourceName)
			const population = query.populations.find(pop => pop.source === sourceName)

			for (const operation of Object.keys(mutationData[sourceName])) {
				const data = mutationData[sourceName][operation]

				await this._execMutation(source, operation, data, population.select(inputData))
			}
		}

		return [ await this.query(queryName, queryInput) ]
	}

	/**
	 * Apply a named mutation
	 * 
	 * @param {String} name 
	 * @param {any} queryInput 
	 * @param {String} queryName 
	 * @param {Object} data 
	 * @param {Object} docData 
	 * @returns {Object}
	 * 
	 * @memberOf Model
	 */
	async namedMutate(name, queryInput, queryName, data, docData) {
		const query = this._getQuery(queryName || 'default')
		const mutation = this._getMutation(name)
		const inputData = query.inputs.toSource(queryInput)

		const validatorResult = validator.validate(mutation.type, data)

		if (!validatorResult.valid) {
			return [
				undefined,
				{ err: new Error('Invalid'), data: validatorResult.error }
			]
		}

		for (const method of mutation.methods) {
			const source = this._getSource(method.source)
			const population = query.populations.find(pop => pop.source === method.source)
			const mutatedData = method.data(data, docData)

			await this._execMutation(source, method.operation, mutatedData, population.select(inputData))
		}

		return [await this.query(queryName, queryInput) ]
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
	 * Apply 'update' and 'create' mutations and return a new Document using
	 * the default query
	 * 
	 * @param {any} inputData 
	 * @returns {Object}
	 * 
	 * @memberOf Model
	 */
	async create(inputData) {
		const query = this._getQuery('default')
		const data = { ...this.defaults, ...inputData }
		const inputDataWithDefaults = Object.keys(data).reduce((acc, key) => ({
			...acc,
			[key]: typeof data[key] === 'function' ? data[key]() : data[key]
		}), {})

		const validatorResult = validator.validate(this.mutationSchema, inputDataWithDefaults)

		if (!validatorResult.valid) {
			return [
				undefined,
				{ err: new Error('Invalid'), data: validatorResult.error }
			]
		}

		let rawData = {}
		let mappedData

		const mutations = this._getMutations(Object.keys(inputDataWithDefaults))
			// Group all mutations by source
			.reduce((acc, item) => {
				const source = item.source
				const operation = item.operation || 'update'
				const input = inputDataWithDefaults[item.property]

				if (operation !== 'update' && operation !== 'create') return acc
				
				if (source in acc) {
					return {
						...acc,
						[source]: [...acc[source], { fn: item.data, input }]
					}
				} else {
					return {
						...acc,
						[source]: [{ fn: item.data, input }]
					}
				}
			}, {})

		for (const item of query.populations) {
			const source = this._getSource(item.source)
			const initializer = item.source in mutations
			let sourceData
			let data

			// Create a new document for each source with an initializer.
			// If the source does not have an initializer, process the source
			// as if through a query
			if (initializer) {
				if (source.many) {
					// If source is many, data should be an array of objects
					// rather than a single object
					data = mutations[item.source].reduce((acc, mutation) => ([
						...acc,
						...mutation.fn(mutation.input, rawData)
					]), [])
				} else {
					data = mutations[item.source].reduce((acc, mutation) => ({
						...acc,
						...mutation.fn(mutation.input, rawData)
					}), {})
				}

				sourceData = await this._createFromSchema(source.schema, data, source.many)
			} else {
				sourceData = await this._readFromSchema(source.schema, item.select(rawData), source.many)
			}

			rawData = { ...rawData, [source.name]: sourceData }
		}
		
		mappedData = this.dataMap(rawData)

		return [ new Document(this, mappedData, query.inputs.fromSource(rawData), rawData) ]
	}

	async _execMutation(source, operation, data, selector) {
		switch (operation) {
			case 'create':
				return await source.schema.create(data)
			case 'delete':
				return await source.schema.del(data)
			default:
				return await source.schema.update(selector, data)
		}
	}

	_getMutations(names) {
		return names.reduce((acc, prop) => {
			if (prop in this.mutations) {
				return acc.concat(
					[].concat(this.mutations[prop].methods).map(method => ({
						...method,
						property: prop
					}))
				)
			}

			return acc
		}, [])
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

	_createFromSchema(schema, data) {
		return schema.create(data)
	}

	_getSource(name) {
		return this.sources.find(source => source.name === name)
	}

	_getMutation(name) {
		return this.mutations[name]
	}

	_getQuery(name) {
		return this.queries.find(query => query.name === name).query
	}
}

module.exports = Model