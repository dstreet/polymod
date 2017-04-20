class ModelSchema {
	constructor(model, query) {
		this.model = model
		this.query = query || 'default'
	}

	get type() {
		if (this._type) return this._type

		const descriptor = this.model.describe()
		this._type = Object.keys(descriptor).reduce((acc, key) => {
			return { ...acc, [key]: descriptor[key].type }
		}, {})

		return this._type
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