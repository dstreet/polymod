/* eslint-env jest */
const MemStore = require('./mem-store')

test('`create()` should add the document to the data collection', async () => {
	const store = new MemStore()

	expect(store._data).toEqual({})

	store.create('tests', {
		foo: 'bar'
	})

	expect(store._data).toHaveProperty('tests')
	expect(store._data.tests).toHaveLength(1)
	expect(store._data.tests[0]).toHaveProperty('foo', 'bar')
})

test('`create()` should add an id to the document if not provided', async () => {
	const store = new MemStore()

	expect(store._data).toEqual({})

	store.create('tests', {
		foo: 'bar'
	})

	expect(store._data.tests[0]).toHaveProperty('id')

	store._data.tests = []
	store.create('tests', {
		id: 1,
		foo: 'bar'
	})

	expect(store._data.tests[0]).toHaveProperty('id', 1)
})

test('`read()` should return an array of matching documents', async () => {
	const store = new MemStore({
		posts: [
			{
				id: 1,
				title: 'post 1',
				author: 'jdoe'
			},
			{
				id: 2,
				title: 'post 2',
				author: 'jdoe'
			},
			{
				id: 3,
				title: 'post 3',
				author: 'jsmith'
			}
		]
	})

	const docs = await store.read('posts', { author: 'jdoe' })

	expect(docs).toHaveLength(2)
	expect(docs[0]).toEqual({
		id: 1,
		title: 'post 1',
		author: 'jdoe'
	})
	expect(docs[1]).toEqual({
		id: 2,
		title: 'post 2',
		author: 'jdoe'
	})
})

test('`update()` should update the matching documents with the provided data', async () => {
	const store = new MemStore({
		posts: [
			{
				id: 1,
				title: 'post 1',
				author: 'jdoe'
			},
			{
				id: 2,
				title: 'post 2',
				author: 'jdoe'
			},
			{
				id: 3,
				title: 'post 3',
				author: 'jsmith'
			}
		]
	})

	const updatedDocs = await store.update('posts', { author: 'jsmith' }, { title: 'updated post' })
	
	expect(updatedDocs).toHaveLength(1)
	expect(updatedDocs[0]).toEqual({
		id: 3,
		title: 'updated post',
		author: 'jsmith'
	})
	expect(store._data.posts[2]).toEqual({
		id: 3,
		title: 'updated post',
		author: 'jsmith'
	})
})

test('`del()` should delete the matching documents', async () => {
	const store = new MemStore({
		posts: [
			{
				id: 1,
				title: 'post 1',
				author: 'jdoe'
			},
			{
				id: 2,
				title: 'post 2',
				author: 'jdoe'
			},
			{
				id: 3,
				title: 'post 3',
				author: 'jsmith'
			}
		]
	})

	const deletedDocs = await store.del('posts', { author: 'jdoe' })

	expect(deletedDocs).toHaveLength(2)
	expect(deletedDocs[0]).toEqual({
		id: 1,
		title: 'post 1',
		author: 'jdoe'
	})
	expect(deletedDocs[1]).toEqual({
		id: 2,
		title: 'post 2',
		author: 'jdoe'
	})
})

test('update() $push should append values to property arrays', async () => {
	const store = new MemStore({
		posts: [
			{
				id: 1,
				title: 'post 1',
				author: 'jdoe',
				tags: [1, 2]
			}
		]
	})

	const updatedDocs = await store.update('posts', { id: 1 }, { $push: { tags: 3 }})
	expect(updatedDocs[0]).toEqual({
		id: 1,
		title: 'post 1',
		author: 'jdoe',
		tags: [1, 2, 3]
	})
})