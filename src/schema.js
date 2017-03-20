class Schema {
	constructor(store, source, keyField) {
		this.store = store
		this.source = source
		this.keyField = keyField
		this._referenceDocuments = new Map()
	}

	async create(data) {
		return await this.store.create(this.source, data)
	}

	async read(selector, single) {
		const docs = await this.store.read(this.source, selector)

		return single ? docs[0] : docs
	}

	async update(selector, data) {
		return await this.store.update(this.source, selector, data)
	}

	async del(selector) {
		return await this.store.del(this.source, selector)
	}

	async getReferenceDocument(select, many) {
		let refDoc = this._referenceDocuments.get(JSON.stringify(select))

		if (!refDoc) {
			refDoc = await this.read(select, !many)

			this._referenceDocuments.set(
				JSON.stringify(select),
				refDoc
			)
		}

		return refDoc
	}
}

module.exports = Schema