class ModelSchema {
	constructor(model, query) {
		this.model = model
		this.query = query || 'default'
	}

	get type() {
		return this.model.describe()
	}

	async create(data) {
		const [doc, error] = await this.model.create(data)

		if (error) throw error
		return doc.data
	}

	async read(selector) {
		const docs = await this.model.query(this.query, selector)

		return docs.data
	}

	async update(selector, data) {
		const doc = await this.model.get(selector)
		return await doc.mutate(data)
	}

	async del(selector) {
		return await this.model.del(selector, this.query)
	}
}

module.exports = ModelSchema