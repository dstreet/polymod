class Query {
	constructor(multi) {
		this.multi = multi
		this.populations = []
		this.inputs = { toSource: input => input }
		this.dataMap = data => data
	}

	/**
	 * Create a new Query
	 * 
	 * Pass `true` if the query should return multiple
	 * documents
	 * 
	 * @static
	 * @param {Boolean} multi 
	 * @returns {Query}
	 * 
	 * @memberOf Query
	 */
	static create(multi) {
		return new Query(multi)
	}

	/**
	 * Set the input maps.
	 * 
	 * `toSource` should map the input data to the initial
	 * raw document data, to be used during population.
	 * `fromSource` should map the raw document data to an
	 * initial search input used in `toSource`.
	 * 
	 * **Example*
	 * 
	 * ```javascript
	 * .input(
	 * 		id => ({ post: { id }}),
	 * 		({ post }) => post.id
	 * )
	 * ```
	 * 
	 * @param {Function} toSource 
	 * @param {Function} fromSource 
	 * @returns {Query}
	 * 
	 * @memberOf Query
	 */
	input(toSource, fromSource) {
		this.inputs = { toSource, fromSource }
		return this
	}

	/**
	 * Add a source population
	 * 
	 * `select` is a function which is passed the currently
	 * available raw document data. It should return a query
	 * suitable for the data store.
	 * 
	 * @param {String} source 
	 * @param {Function} select 
	 * @returns {Query}
	 * 
	 * @memberOf Query
	 */
	populate(source, select) {
		this.populations.push({ source, select })
		return this
	}

	/**
	 * Set the query result map
	 * 
	 * This is a function that, when `multi` is true, should
	 * transform the raw data into an array of objects suitable
	 * for the Model `map`.
	 * 
	 * @param {Function} fn 
	 * @returns {Query}
	 * 
	 * @memberOf Query
	 */
	map(fn) {
		this.dataMap = fn
		return this
	}
}

module.exports = Query