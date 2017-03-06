class Schema {
	constructor(store, source, keyField) {
		this.store = store
		this.source = source
		this.keyField = keyField
	}

	async create(data) {
		console.log(data)
		return await this.store.create(this.source, data)
	}

	async read(selector, single) {
		const docs = await this.store.read(this.source, selector)

		return single ? docs[0] : docs
	}

	async update(selector, data) {
		return await this.store.update(this.source, selector, data)
	}
}

module.exports = Schema