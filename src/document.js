class Document {
	constructor(model, data, input, query, rawData) {
		this.model = model
		this._data = data
		this._rawData = rawData
		this.input = input
		this.query = query
	}

	/**
	 * The document data
	 * 
	 * @readonly
	 * 
	 * @memberOf Document
	 */
	get data() {
		return Object.assign({}, this._data)
	}

	/**
	 * Apply a mutation to the document
	 * 
	 * @param {String} name 
	 * @param {any} data 
	 * @returns {Document}
	 * 
	 * @memberOf Document
	 */
	mutate(name, data) {
		return this.model.mutate(name, this.input, this.query, data, this._rawData)
	}

	/**
	 * Delete the document
	 * 
	 * @returns {Object}
	 * 
	 * @memberOf Document
	 */
	del() {
		return this.model.del(this.input, this.query)
	}
}

module.exports = Document