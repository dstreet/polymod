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

			await document.addField(key, field, field.select(val))
		}

		return document
	}

	async getAll(val) {
		const documents = []

		for (const key in this.fields) {
			const field = this.fields[key]
			const refDocs = await field.schema.getReferenceDocument(field.select(val), true)

			for (let i = 0; i < refDocs.length; i++) {
				if (!documents[i]) documents[i] = new Document(this)

				await documents[i].addFieldWithReference(key, field, field.select(val), refDocs[i])
			}
		}

		return documents
	}

	create() {
		const document = new Document(this, true)

		for (const key in this.fields) {
			const field = this.fields[key]

			document.createField(key, field)
		}

		return document
	}

	mutation(name, mutation) {
		this.mutation[name] = mutation

		return this
	}

	asField(many) {
		return {
			select: val => val,
			get: doc => doc,
			schema: {
				update: async (select, data) => {
					return await data.commit()
				},
				getReferenceDocument: async select => {
					return many ? await this.getAll(select) : await this.get(select)
				}
			}
		}
	}
}

module.exports = Model