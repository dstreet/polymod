const Document = require('./document')

class Model {
	constructor(fields) {
		this.fields = fields
		this.mutations = {}
	}

	static create(fields) {
		return new Model(fields)
	}

	async get(val) {
		const document = new Document(this)

		for (const key in this.fields) {
			const field = this.fields[key]
			const result = await field.get(val)

			document.addField(key, field, field.select(val), result)
		}

		return document
	}

	async getAll(val) {
		const documents = []

		for (const key in this.fields) {
			const field = this.fields[key]
			const data = await field.get(val, true)

			data.forEach((item, i) => {
				if (!documents[i]) documents[i] = new Document(this)

				documents[i].addField(key, field, field.select(val), item)
			})
		}

		return documents
	}

	mutation(name, mutation) {
		this.mutation[name] = mutation

		return this
	}

	asField(many) {
		let cachedDocument

		return {
			select: val => val,
			get: async val => {
				const doc = many ? await this.getAll(val) : await this.get(val)
				
				cachedDocument = doc
				return doc
			},
			set: async data => {
				for (const key in data) {
					await cachedDocument.set(key, data[key])
				}

				return cachedDocument
			},
			cache: cachedDocument,
			commit: async () => {
				await cachedDocument.commit()
			}
		}
	}
}

module.exports = Model