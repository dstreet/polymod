const Document = require('./document')
const validator = require('./validator')

class Model {
	constructor() {
		this._sources = {}
		this._queries = {}
		this._mutations = {}
		this._sourceGraph = undefined
		this._initializer = undefined
		this._dataDescriptor = undefined
		this.sourceMap = sources => sources
	}

	addSource(name, source) {
		this._sources[name] = source
		return this
	}

	getSource(name) {
		return this._sources[name]
	}

	addQuery(name, query) {
		this._queries[name] = query
		return this
	}

	getQuery(name) {
		return this._queries[name]
	}

	addMutation(name, mutation, type) {
		this._mutations[name] = { sources: mutation, type }
		return this
	}

	getMutation(name) {
		return this._mutations[name].sources
	}

	setInitializer(mutation, queryName = 'default', type) {
		this._initializer = { mutation, type, query: this._queries[queryName] }
		return this
	}

	setRemove(mutation) {
		this.destructor = { mutation }
		return this
	}

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
				return {
					...acc,
					[key]: data[key].data(sourceData)
				}
			}, {})
		}

		return this
	}

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

	get(input) {
		return this.query('default', input)
	}

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

	validateMutation(mutation, data = mutation) {
		let mutationSchema
		
		if (typeof mutation === 'string') {
			mutationSchema = this.getMutationSchema(mutation)	
		} else {
			mutationSchema = this.getMutationSchemaForObject(mutation)
		}

		return validator.validate(mutationSchema, data)
	}

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

	fetch(operation, selector) {
		return this.query(operation, selector)
	}

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