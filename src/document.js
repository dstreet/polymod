class Document {
	constructor(model, isNew) {
		this.model = model
		this.isNew = isNew
		this.fields = {}
		this.schemaRefMap = []
	}

	async addField(fieldName, fieldDefinition, select) {
		const refDoc = await fieldDefinition.schema.getReferenceDocument(select)
		await this.addFieldWithReference(fieldName, fieldDefinition, select, refDoc)

		return this
	}

	async addFieldWithReference(fieldName, fieldDefinition, select, refDoc) {
		if (!this.schemaRefMap.find(item => item.document === refDoc)) {
			this.schemaRefMap.push({ schema: fieldDefinition.schema, document: refDoc, select })
		}

		this.fields[fieldName] = {
			fieldDefinition,
			referenceDocument: refDoc,
			data: await fieldDefinition.get(refDoc),
			dirty: false
		}

		return this
	}

	createField(fieldName, fieldDefinition) {
		const select = fieldDefinition.select
		const refDoc = {}

		if (!this.schemaRefMap.find(item => item.document === refDoc)) {
			this.schemaRefMap.push({ schema: fieldDefinition.schema, document: refDoc, select })
		}

		this.fields[fieldName] = {
			fieldDefinition,
			referenceDocument: refDoc,
			data: undefined,
			dirty: false
		}

		return this
	}

	get(fieldName) {
		return this.fields[fieldName].data
	}

	getFieldDocument(fieldName) {
		const field = this.fields[fieldName]
		return field.referenceDocument
	}

	async set(fieldName, data) {
		if (typeof fieldName === 'object') {
			for (const key in fieldName) {
				const field = this.fields[key]

				if (field) await this._setField(field, fieldName[key])
			}
		} else {
			const field = this.fields[fieldName]

			if (field) await this._setField(field, data)
		}

		return this
	}

	async _setField(field, data) {
		field.data = field.fieldDefinition.set ?
				await field.fieldDefinition.set(data) :
				data
		field.raw = data
		field.dirty = true
	}

	async mutate(name, data) {
		const mutation = this.model.mutation[name]
		const docFields = await mutation(this, data)

		for (const key in docFields) {
			await this.set(key, docFields[key])
		}

		return this
	}

	// async commit() {
	// 	const dirtyFields = Object.keys(this.fields)
	// 		.filter(key => this.fields[key].dirty)
	// 		.map(key => this.fields[key])
		
	// 	for (const field of dirtyFields) {
	// 		const commitData = field.fieldDefinition.commit(field.raw)
	// 		const refDoc = this.referenceDocuments[field.referenceDocument]

	// 		refDoc.documents = { ...refDoc.documents, ...commitData }
	// 		field.dirty = false
	// 	}

	// 	// TODO: Only commit documenents that have changed
	// 	for (const refDoc of this.referenceDocuments) {
	// 		if (this.isNew) {
	// 			const newRefDocuments = await refDoc.schema.create(refDoc.documents)

	// 			refDoc.documents = newRefDocuments
	// 			refDoc.select = { [refDoc.schema.keyField]: newRefDocuments[refDoc.schema.keyField] }
	// 			this.isNew = false
	// 		} else {
	// 			await refDoc.schema.update(refDoc.select, refDoc.documents)
	// 		}
	// 	}
	// }

	async commit() {
		const dirtyFields = Object.keys(this.fields)
			.filter(key => this.fields[key].dirty)
			.map(key => this.fields[key])
		
		for (const field of dirtyFields) {
			const commitData = field.fieldDefinition.commit(field.raw)

			Object.assign(field.referenceDocument, commitData)
			field.dirty = false
		}

		for (const schemaRef of this.schemaRefMap) {
			if (this.isNew) {
				const newRefDocument = await schemaRef.schema.create(schemaRef.document)
				const select = { [schemaRef.schema.keyField]: newRefDocument[schemaRef.schema.keyField] }

				for (const key in this.fields) {
					if (this.fields[key].referenceDocument === schemaRef.document) {
						this.fields[key].referenceDocument = newRefDocument
					}
				}

				schemaRef.document = newRefDocument
				schemaRef.select = select

				this.isNew = false
			} else {
				await schemaRef.schema.update(schemaRef.select, schemaRef.document)
			}
		}
	}
}

module.exports = Document