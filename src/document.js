const assert = require('assert')

class Document {
	/**
	 * Create a new Document from a model initializer
	 * 
	 * @static
	 * @param {Model} model 
	 * @param {Object} initializer 
	 * @param {Object} data 
	 * @returns {Document}
	 * @memberof Document
	 */
	static async createFromInitializer(model, initializer, data) {
		const resultData = {}
		const selectors = {}
		const nodes = initializer.query.getSortedNodes()
		const mutationStructure = initializer.mutation

		for (const node of nodes) {
			const mutation = mutationStructure.find(m => m.source === node)
			let fetchSource = false

			if (mutation) {
				const source = model.getSource(mutation.source)
				const operations = mutation.operations(data, { ...resultData })

				const mutationResults = await source.mutate(operations)

				if (typeof mutation.results === 'function') {
					resultData[node] = mutation.results(mutationResults)
				} else {
					fetchSource = true
				}
			} else {
				fetchSource = true
			}

			if (fetchSource) {
				resultData[node] = await initializer.query.fetchSource(model, node, resultData)
			}

			selectors[node] = initializer.query.getSourceSelector(node, resultData)
		}

		try {
			resultData.input = initializer.query.inputConstructor(resultData)
		} catch (err) {
			throw new Error('Mutation failed: query missing `inputConstructor`')
		}

		return [ new Document(model, initializer.query, initializer.query.createResult(selectors, resultData)) ]
	}

	/**
	 * Creates an instance of Document
	 * 
	 * @param {Model} model 
	 * @param {Query} query 
	 * @param {QueryResult} queryResult 
	 * @memberof Document
	 */
	constructor(model, query, queryResult) {
		this.model = model
		this._queryResult = queryResult
		this.query = query
		this._data = model.sourceMap(queryResult.data)
		this._removed = false
	}

	/**
	 * The document data
	 * 
	 * @readonly
	 * @memberof Document
	 */
	get data() {
		return { ...this._data }
	}

	/**
	 * If the document has been removed
	 * 
	 * @readonly
	 * @memberof Document
	 */
	get removed() {
		return this._removed
	}

	/**
	 * Perform a mutation on the document
	 * 
	 * @param {[String]} mutationName
	 * @param {[any]} mutationData
	 * @returns {Document}
	 * @memberof Document
	 */
	async mutate(...args) {
		if (this._removed) {
			throw new Error('Attempting to mutate a removed document')
		}

		if (args.length === 1) {
			return this._multiMutate(args[0])
		} else {
			return this._singleMutate(args[0], args[1])
		}
	}

	/**
	 * Removes the document and disables the ability to further mutate
	 * the document
	 * 
	 * @returns {Object}
	 * @memberof Document
	 */
	async remove() {
		if (this._removed) {
			throw new Error('Attempting to remove an already removed document')
		}

		const mutationStructure = this.model.destructor.mutation
		const results = {}

		for (const mutation of mutationStructure) {
			const source = this.model.getSource(mutation.source)
			const operations = mutation.operations({
				input: this._queryResult.input,
				...this._queryResult.data
			})

			const mutationResults = await source.mutate(operations)
			
			if (typeof mutation.result === 'function') {
				results[mutation.source] = mutationResults(mutationResults)
			} else {
				results[mutation.source] = mutationResults
			}
		}

		this._removed = true

		return results
	}

	/**
	 * Process mutliple mutations from a data mapping, where each key is the
	 * name of a mutation, and the value is the mutation data
	 * 
	 * @param {Object} dataMap 
	 * @returns {Document}
	 * @memberof Document
	 * @private
	 */
	async _multiMutate(dataMap) {
		const mutationStructure = this._getMutationStructureFromDataMap(dataMap)
		const resultData = { ...this._queryResult.data }
		const nodes = this.query.getSortedNodes()
		const newQuery = this.query.copy()
		const selectors = this._queryResult.selectors

		const validationResult = this.model.validateMutation(dataMap)

		if (!validationResult.valid) {
			return [
				undefined,
				{ err: new Error('Invalid data passed to `mutate`'), data: validationResult.error }
			]
		}

		for (const node of nodes) {
			const mutation = mutationStructure.find(m => m.source === node)

			if (mutation) {
				const source = this.model.getSource(mutation.source)
				const operations = mutation.operations(dataMap, {
					input: this._queryResult.input,
					...this._queryResult.data
				})

				await source.mutate(operations)
			// Do not fetch the source if the selectors have not changed
			} else if (!this._shouldRefreshSource(node, resultData)) {
				continue
			}

			selectors[node] = this.query.getSourceSelector(node, resultData)
			resultData[node] = await this.query.fetchSource(this.model, node, resultData)
		}

		try {
			resultData.input = newQuery.inputConstructor(resultData)
		} catch (err) {
			throw new Error('Mutation failed: query missing `inputConstructor`')
		}
		
		return [ new Document(this.model, newQuery, newQuery.createResult(selectors, resultData)) ]
	}

	/**
	 * Process a single mutation
	 * 
	 * @param {String} name 
	 * @param {Object} data 
	 * @returns {Document}
	 * @memberof Document
	 * @private
	 */
	async _singleMutate(name, data) {
		const mutationStructure = this.model.getMutation(name)
		const nodes = this.query.getSortedNodes()
		const resultData = { ...this._queryResult.data }
		const newQuery = this.query.copy()
		const selectors = this._queryResult.selectors

		const validationResult = this.model.validateMutation(name, data)

		if (!validationResult.valid) {
			return [
				undefined,
				{ err: new Error('Invalid data passed to `mutate`'), data: validationResult.error }
			]
		}

		for (const node of nodes) {
			const mutation = mutationStructure.find(m => m.source === node)
			let shouldFetch = false

			if (mutation) {
				const source = this.model.getSource(mutation.source)
				const operations = mutation.operations(data, {
					input: this._queryResult.input,
					...this._queryResult.data
				})

				const mutationResults = await source.mutate(operations)

				// If a `result` function is defined, use the result of that function
				// as the source value, otherwise do a fetch on the source
				if (typeof mutation.result === 'function') {
					resultData[node] = mutation.result(mutationResults)
				} else {
					shouldFetch = true
				}
			} else if (this._shouldRefreshSource(node, resultData)) {
				shouldFetch = true
			}

			if (shouldFetch) {
				resultData[node] = await this.query.fetchSource(this.model, node, resultData)
			}

			selectors[node] = this.query.getSourceSelector(node, resultData)
		}

		try {
			resultData.input = newQuery.inputConstructor(resultData)
		} catch (err) {
			throw new Error('Mutation failed: query missing `inputConstructor`')
		}

		return [ new Document(this.model, newQuery, newQuery.createResult(selectors, resultData)) ]
	}

	/**
	 * Transform a mutation data mapping to something we can use to perform
	 * a mutation.
	 * 
	 * @param {Object} dataMap 
	 * @returns {Object}
	 * @memberof Document
	 * @private
	 */
	_getMutationStructureFromDataMap(dataMap) {
		const mutation = Object.keys(dataMap)
			.reduce((acc, key) => {
				const mutationSources = this.model.getMutation(key).map(m => ({ ...m, prop: key }))
				return acc.concat(mutationSources)
			}, [])
			.reduce((acc, mutation) => {
				if (acc[mutation.source]) {
					return {
						...acc,
						[mutation.source]: {
							operations: acc[mutation.source].operations.concat({
								cb: mutation.operations,
								prop: mutation.prop
							})
						}
					}
				} else {
					return {
						...acc,
						[mutation.source]: {
							operations: [{
								cb: mutation.operations,
								prop: mutation.prop
							}],
						}
					}
				}
			}, {})

		return Object.keys(mutation).map(key => {
			return {
				source: key,
				operations: (input, data) => {
					return mutation[key].operations.reduce((acc, operation) => {
						return acc.concat(operation.cb(input[operation.prop], data))
					}, [])
				}
			}
		})
	}

	/**
	 * Determine if a source should be refreshed by comparing its existing
	 * selector to a new selector computed by the data
	 * 
	 * @param {String} sourceName 
	 * @param {Object} data 
	 * @returns {Boolean}
	 * @memberof Document
	 * @private
	 */
	_shouldRefreshSource(sourceName, data) {
		const oldSelector = this._queryResult.getSelector(sourceName)
		const newSelector = this.query.getSourceSelector(sourceName, data)

		try {
			assert.deepStrictEqual(newSelector, oldSelector)
			return false
		} catch(err) {
			return true
		}
	}
}

module.exports = Document