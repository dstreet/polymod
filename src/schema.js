class Schema {
	constructor(store, source) {
		this.store = store
		this.source = source
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
}

module.exports = Schema