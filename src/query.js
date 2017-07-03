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
	static copy(original) {
		const query = new Query()

		query.setInputConstructor(original.inputConstructor)
		original.populations.forEach(p => {
			query.addPopulation(p)
		})

		return query
	}

	constructor() {
		this._sourceGraph = undefined
		this._populations = []
	}

	get sourceGraph() {
		if (!this._sourceGraph) {
			this._sourceGraph = this._getGraph(this._populations)
		}
		
		return this._sourceGraph
	}

	get populations() {
		return [ ...this._populations ]
	}

	copy() {
		return Query.copy(this)
	}

	createResult(selectors, data) {
		return new QueryResult(this.inputConstructor(data), selectors, data)
	}

	setInputConstructor(cb) {
		this.inputConstructor = cb
		return this
	}

	getSourceSelector(source, data) {
		return this._sourceGraph.node(source).selector(data)
	}

	getSelectors(data) {
		return this.populations.reduce((acc, population) => {
			return {
				...acc,
				[population.name]: population.selector(data)
			}
		}, {})
	}

	fetchSource(model, sourceName, data) {
		const source = model.getSource(sourceName)
		const node = this.sourceGraph.node(sourceName)
		return this._doFetch(source, node.operation, node.selector(data))
	}

	addPopulation(population) {
		this._populations.push(population)
		return this
	}

	mapDocument(cb) {
		this.documentMapping = cb
		return this
	}

	async exec(model, input) {
		const { selectors, data} = await this._fetchSourceData(model, { input })

		return new QueryResult(input, selectors, data)
	}

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

	getSortedNodes() {
		try {
			return graphlib.alg.topsort(this.sourceGraph)
		} catch (err) {
			if (err instanceof graphlib.alg.topsort.CycleException) {
				throw new Error('Cannot fetch a query with circular `require`s')
			}
		}
	}

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