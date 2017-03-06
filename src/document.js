class Document {
	constructor(model, isNew) {
		this.model = model
		this.isNew = true
		this.fields = {}
	}

	addField(fieldName, field, select, data) {
		this.fields[fieldName] = { field, select, data, dirty: false }

		return this
	}

	async set(fieldName, data) {
		const field = this.fields[fieldName]
		
		if (field) {
			field.data = field.field.set ? await field.field.set(data) : data
			field.raw = data
			field.dirty = true
		}

		return this
	}

	async mutate(name, data) {
		const mutation = this.model.mutation[name]
		const docFields = await mutation(this, data)

		for (const key in docFields) {
			await this.set(key, docFields[key])
		}

		return this
	}

	get(fieldName) {
		return this.fields[fieldName].data
	}

	getFieldDocument(fieldName) {
		return this.fields[fieldName].field.cached
	}

	async commit() {
		const dirtyFields = Object.keys(this.fields)
			.filter(key => this.fields[key].dirty)
			.map(key => this.fields[key])
		
		for (const field of dirtyFields) {
			await field.field.commit(field.select, field.raw)
			
			field.dirty = false
		}
	}
}

module.exports = Document