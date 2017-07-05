const graphlib = require('graphlib')
const Graph = graphlib.Graph

class QueryResult {
	constructor(input, selectors, data) {
		this.input = input
		// Cache the source selectors
		this._selectors = selectors
		this._data = data
	}

	get data() {
		return { ...this._data }
	}

	get selectors() {
		return { ...this._selectors }
	}

	getSelector(source) {
		return this._selectors[source]
	}
}

class Query {
	/**
	 * Make a copy of an existing Query instance
	 * 
	 * @static
	 * @param {Query} original 
	 * @returns {Query}
	 * @memberof Query
	 */
	static copy(original) {
		const query = new Query()

		query.setInputConstructor(original.inputConstructor)
		original.populations.forEach(p => {
			query.addPopulation(p)
		})

		return query
	}

	/**
	 * Create a new instance of Query
	 * 
	 * @static
	 * @returns {Query}
	 * @memberof Query
	 */
	static create() {
		return new Query()
	}

	/**
	 * Creates an instance of Query.
	 * 
	 * @memberof Query
	 */
	constructor() {
		this._sourceGraph = undefined
		this._populations = []
	}

	/**
	 * The query source graph
	 * 
	 * @readonly
	 * @memberof Query
	 */
	get sourceGraph() {
		if (!this._sourceGraph) {
			this._sourceGraph = this._getGraph(this._populations)
		}
		
		return this._sourceGraph
	}

	/**
	 * The query populations
	 * 
	 * @readonly
	 * @memberof Query
	 */
	get populations() {
		return [ ...this._populations ]
	}

	/**
	 * Make a copy of this Query instance
	 * 
	 * @returns {Query}
	 * @memberof Query
	 */
	copy() {
		return Query.copy(this)
	}

	/**
	 * Build a new QueryResult
	 * 
	 * @param {Object} selectors 
	 * @param {Object} data 
	 * @returns {QueryResult}
	 * @memberof Query
	 */
	createResult(selectors, data) {
		return new QueryResult(this.inputConstructor(data), selectors, data)
	}

	/**
	 * Set the function used to transform the document data to a query input
	 * 
	 * @param {Function} cb 
	 * @returns {Query}
	 * @memberof Query
	 */
	setInputConstructor(cb) {
		this.inputConstructor = cb
		return this
	}

	/**
	 * Get the selector for a given source
	 * 
	 * @param {String} source 
	 * @param {Object} data 
	 * @returns {any}
	 * @memberof Query
	 */
	getSourceSelector(source, data) {
		return this._sourceGraph.node(source).selector(data)
	}

	/**
	 * Get the selectors for all sources
	 * 
	 * @param {Object} data 
	 * @returns {Object}
	 * @memberof Query
	 */
	getSelectors(data) {
		return this.populations.reduce((acc, population) => {
			return {
				...acc,
				[population.name]: population.selector(data)
			}
		}, {})
	}

	/**
	 * Fetch the data for a source
	 * 
	 * @param {Model} model 
	 * @param {String} sourceName 
	 * @param {any} data 
	 * @returns {Object}
	 * @memberof Query
	 */
	fetchSource(model, sourceName, data) {
		const source = model.getSource(sourceName)
		const node = this.sourceGraph.node(sourceName)
		return this._doFetch(source, node.operation, node.selector(data))
	}

	/**
	 * Add a source population to the query
	 * 
	 * @param {Object} population 
	 * @returns {Query}
	 * @memberof Query
	 */
	addPopulation(population) {
		this._populations.push(population)
		return this
	}

	/**
	 * Set the function to map source data to document data
	 * 
	 * @param {Function} cb 
	 * @returns {Query}
	 * @memberof Query
	 */
	mapDocument(cb) {
		this.documentMapping = cb
		return this
	}

	/**
	 * Execute the query
	 * 
	 * @param {Model} model 
	 * @param {any} input 
	 * @returns {QueryResult}
	 * @memberof Query
	 */
	async exec(model, input) {
		const { selectors, data} = await this._fetchSourceData(model, { input })

		return new QueryResult(input, selectors, data)
	}

	/**
	 * Get the sorted graph nodes
	 * 
	 * @returns {Array}
	 * @memberof Query
	 */
	getSortedNodes() {
		try {
			return graphlib.alg.topsort(this.sourceGraph)
		} catch (err) {
			if (err instanceof graphlib.alg.topsort.CycleException) {
				throw new Error('Cannot fetch a query with circular `require`s')
			}
		}
	}

	/**
	 * Get the population graph
	 * 
	 * @param {Array} populations 
	 * @returns {Graph}
	 * @memberof Query
	 * @private
	 */
	_getGraph(populations) {
		const graph = new Graph({ directed: true })

		populations.forEach(item => {
			graph.setNode(item.name, item)

			if (item.require && item.require.length) {
				item.require.forEach(v => {
					graph.setEdge(v, item.name)
				})
			}
		})

		return graph
	}

	/**
	 * Fetch source data
	 * 
	 * @param {Model} model 
	 * @param {any} initialData 
	 * @returns {Promise}
	 * @memberof Query
	 * @private
	 */
	async _fetchSourceData(model, initialData) {
		const nodes = this.getSortedNodes()
		const data = { ...initialData }
		const selectors = {}

		for (const v of nodes) {
			const node = this.sourceGraph.node(v)
			const source = model.getSource(v)
			const selector = node.selector(data)

			selectors[v] = selector
			data[v] = await this._doFetch(source, node.operation, selector)
		}

		return { selectors, data }
	}

	/**
	 * Perform a fetch on the source
	 * 
	 * @param {Source} source 
	 * @param {String} operation 
	 * @param {any} selector 
	 * @returns {Promise}
	 * @memberof Query
	 * @private
	 */
	_doFetch(source, operation, selector) {
		if (Array.isArray(selector)) {
			return Promise.all(
				selector.map(s => {
					return source.fetch(operation, s)
				})
			)
		} else {
			return source.fetch(operation, selector)
		}
	}
}

module.exports = { Query, QueryResult }