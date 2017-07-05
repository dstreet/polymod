const Document = require('./document')
const validator = require('./validator')

class Model {
	/**
	 * Create a new model instance
	 * 
	 * @static
	 * @returns {Model}
	 * @memberof Model
	 */
	static create() {
		return new Model()
	}

	/**
	 * Creates an instance of Model
	 * @memberof Model
	 */
	constructor() {
		this._sources = {}
		this._queries = {}
		this._mutations = {}
		this._sourceGraph = undefined
		this._initializer = undefined
		this._dataDescriptor = undefined
		this.sourceMap = sources => sources
	}

	/**
	 * Add a new model source
	 * 
	 * @param {String} name 
	 * @param {Object} source 
	 * @returns {Model}
	 * @memberof Model
	 */
	addSource(name, source) {
		this._sources[name] = source
		return this
	}

	/**
	 * Get a source by name
	 * 
	 * @param {String} name 
	 * @returns {Object}
	 * @memberof Model
	 */
	getSource(name) {
		return this._sources[name]
	}

	/**
	 * Register a query with the model
	 * 
	 * @param {String} name 
	 * @param {Query} query 
	 * @returns {Model}
	 * @memberof Model
	 */
	addQuery(name, query) {
		this._queries[name] = query
		return this
	}

	/**
	 * Get a query by name
	 * 
	 * @param {String} name 
	 * @returns {Query}
	 * @memberof Model
	 */
	getQuery(name) {
		return this._queries[name]
	}

	/**
	 * Register a mutation with the model
	 * 
	 * @param {String} name 
	 * @param {Object} mutation 
	 * @param {any} type 
	 * @returns {Model}
	 * @memberof Model
	 */
	addMutation(name, mutation, type) {
		this._mutations[name] = { sources: mutation, type }
		return this
	}

	/**
	 * Get a mutation by name
	 * 
	 * @param {String} name 
	 * @returns {Object}
	 * @memberof Model
	 */
	getMutation(name) {
		return this._mutations[name].sources
	}

	/**
	 * Set the initializer for creating a new document
	 * 
	 * @param {String} mutation 
	 * @param {string} [queryName='default'] 
	 * @param {any} type 
	 * @returns {Model}
	 * @memberof Model
	 */
	setInitializer(mutation, queryName = 'default', type) {
		this._initializer = { mutation, type, query: this._queries[queryName] }
		return this
	}

	/**
	 * Set the mutation to use when removing a document
	 * 
	 * @param {Object} mutation 
	 * @returns {Model}
	 * @memberof Model
	 */
	setRemove(mutation) {
		this.destructor = { mutation }
		return this
	}

	/**
	 * Get or set the data descriptors
	 * 
	 * @param {[Object]} data 
	 * @returns {Model}
	 * @memberof Model
	 */
	describe(data) {
		if (!data) {
			return Object.keys(this._dataDescriptor).reduce((acc, key) => {
				return {
					...acc,
					[key]: this._dataDescriptor[key].raw
				}
			}, {})
		}

		this._dataDescriptor = Object.keys(data).reduce((acc, key) => {
			return {
				...acc,
				[key]: {
					raw: {
						type: data[key].type,
						required: data[key].required
					},
					default: data[key].default,
					schema: validator.parseType(data[key].type, data[key].required)
				}
			}
		}, {})

		this.sourceMap = sourceData => {
			return Object.keys(data).reduce((acc, key) => {
				if (typeof data[key].data !== 'function') return acc
				
				return {
					...acc,
					[key]: data[key].data(sourceData)
				}
			}, {})
		}

		return this
	}

	/**
	 * Execute a query by name
	 * 
	 * @param {String} name 
	 * @param {any} input 
	 * @returns {Document|[Document]}
	 * @memberof Model
	 */
	async query(name, input) {
		const query = this._queries[name]
		const result = await query.exec(this, input)

		if (query.documentMapping) {
			const defaultQuery = this._queries['default']
			const mappedData = query.documentMapping(result.data)

			if (!Array.isArray(mappedData)) {
				throw new Error('Data returned from the document map must be an Array')
			}

			return mappedData

				// collect the data and selectors
				.map(data => ({
					data: {
						...data,
						input: 	defaultQuery.inputConstructor(data)
					},
					selectors: defaultQuery.getSelectors(data)
				}))
				// Create a queryResult for each data set
				.map(resultData => defaultQuery.createResult(resultData.selectors, resultData.data))

				// Create a new document with each queryResult
				.map(queryResult => new Document(this, defaultQuery, queryResult))
		}

		return new Document(this, query, result)
	}

	/**
	 * Execute the default query
	 * 
	 * @param {any} input 
	 * @returns {Document|[Document]}
	 * @memberof Model
	 */
	get(input) {
		return this.query('default', input)
	}

	/**
	 * Get the data schema used by mutations for an object
	 * 
	 * @param {any} obj 
	 * @returns {Object}
	 * @memberof Model
	 */
	getMutationSchemaForObject(obj) {
		const mutationSchema = validator.parseType(
			Object.keys(obj).reduce((acc, key) => {
				return {
					...acc,
					[key]: this.getMutationSchema(key)
				}
			}, {})
		)

		return mutationSchema
	}

	/**
	 * Get the mutation schema
	 * 
	 * @param {String} mutation 
	 * @returns {Object}
	 * @memberof Model
	 */
	getMutationSchema(mutation) {
		let mutationSchema

		if (this._mutations[mutation].type) {
			mutationSchema = validator.parseType(this._mutations[mutation].type)
		} else if (this._dataDescriptor &&
			this._dataDescriptor[mutation] &&
			this._dataDescriptor[mutation].schema) {
			mutationSchema = this._dataDescriptor[mutation].schema
		} else {
			mutationSchema = validator.parseType()
		}

		return mutationSchema
	}

	/**
	 * Validate the data for a given mutation
	 * 
	 * @param {String} mutation 
	 * @param {any} [data=mutation] 
	 * @returns {Object}
	 * @memberof Model
	 */
	validateMutation(mutation, data = mutation) {
		let mutationSchema
		
		if (typeof mutation === 'string') {
			mutationSchema = this.getMutationSchema(mutation)	
		} else {
			mutationSchema = this.getMutationSchemaForObject(mutation)
		}

		return validator.validate(mutationSchema, data)
	}

	/**
	 * Create a new document
	 * 
	 * @param {any} data 
	 * @returns {Document}
	 * @memberof Model
	 */
	async create(data) {
		if (!this._initializer) {
			return [
				undefined,
				{ err: new Error('Cannot create a document when no initializer has been set') }
			]
		}

		let dataWithDefaults = this.applyDefaults(data)

		// Type defined by the initializer should override the data descriptor types
		const inputSchema = validator.parseType({
			...reduceWithObject(this._dataDescriptor, val => val.schema),
			...reduceWithObject(this._initializer.type, val => validator.parseType(val))
		})

		const validatorResult = validator.validate(inputSchema, dataWithDefaults)

		if (!validatorResult.valid) {
			return [
				undefined,
				{ err: new Error('Invalid data passed to `create`'), data: validatorResult.error }
			]
		}

		const [ doc ] = await Document.createFromInitializer(this, this._initializer, dataWithDefaults)
		return [ doc ]
	}

	/**
	 * Source interface for fetching document(s)
	 * 
	 * @param {String} operation 
	 * @param {any} selector 
	 * @returns {Document|Document[s]}
	 * @memberof Model
	 */
	fetch(operation, selector) {
		return this.query(operation, selector)
	}

	/**
	 * Source interface for mutating documents
	 * 
	 * @param {String} operations 
	 * @returns {Document|Document[s]}
	 * @memberof Model
	 */
	async mutate(operations) {
		const results = []

		for (const operation of operations) {
			if (operation.name === 'create') {
				const [ doc, err ] = await this.create(operation.data)
				results.push(doc)
			} else {
				// Here selector should be a document
				const [ doc, err ] = await operation.selector.mutate(operation.name, operation.data)
				results.push(doc)
			}
		}
		
		return results
	}

	/**
	 * Apply the data defaults to a data object
	 * 
	 * @param {Object} data 
	 * @returns {Object}
	 * @memberof Model
	 */
	applyDefaults(data) {
		return this._dataDescriptor ?
			{
				...Object.keys(this._dataDescriptor).reduce((acc, key) => {
					if (!this._dataDescriptor[key].default) return acc
					return {
						...acc,
						[key]: this._dataDescriptor[key].default(data)
					}
				}, {}),
				...data
			} :
			data
	}
}

function reduceWithObject(obj, cb) {
	if (!obj) return

	return Object.keys(obj).reduce((acc, key) => {
		return {
			...acc,
			[key]: cb(obj[key])
		}
	}, {})
}

module.exports = Model