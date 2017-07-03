/* eslint-env jest */
const { Query, QueryResult } = require('./query')
const MemStore = require('../src/mem-store')
const Source = require('./mem-source')

test('will fetch data from the sources', async () => {
	const store = new MemStore({
		users: [
			{
				id: 1,
				username: 'jdoe',
				name: { first: 'John', last: 'Doe' },
			},
			{
				id: 2,
				username: 'twaits',
				name: { first: 'Tom', last: 'Waits' },
			}
		],
		tags: [
			{
				id: 1,
				title: 'foo'
			},
			{
				id: 2,
				title: 'bar'
			}
		],
		posts: [
			{
				id: 1,
				title: 'Post 1',
				content: 'This is the first post',
				author: 1,
				tags: [1]
			},
			{
				id: 2,
				title: 'Post 2',
				content: 'This is the second post',
				author: 1,
				tags: [1, 2]
			}
		]
	})

	const Posts = new Source(store, 'posts')
	const Users = new Source(store, 'users')
	const Tags = new Source(store, 'tags')

	const model = {
		getSource(name) {
			switch (name) {
				case 'post':
					return Posts
				case 'author':
					return Users
				case 'tags':
					return Tags
			}
		}
	}

	const populations = [
		{
			name: 'post',
			operation: 'read',
			selector: ({ input }) => ({ id: input })
		},
		{
			name: 'author',
			operation: 'read',
			require: ['post'],
			selector: ({ post }) => {
				return { id: post.author }
			}
		},
		{
			name: 'tags',
			operation: 'read',
			require: ['post'],
			selector: ({ post }) => post.tags.map(id => ({ id }))
		}
	]

	const query = new Query()
	populations.forEach(p => query.addPopulation(p))

	let res = await query.exec(model, 1)
	
	expect(res).toBeInstanceOf(QueryResult)
	expect(res.data).toEqual({
		post: {
			id: 1,
			title: 'Post 1',
			content: 'This is the first post',
			author: 1,
			tags: [1]
		},
		author: {
			id: 1,
			username: 'jdoe',
			name: { first: 'John', last: 'Doe' },
		},
		tags: [{
			id: 1,
			title: 'foo'
		}],
		input: 1
	})

	res = await query.exec(model, 2)
	
	expect(res).toBeInstanceOf(QueryResult)
	expect(res.data).toEqual({
		post: {
			id: 2,
			title: 'Post 2',
			content: 'This is the second post',
			author: 1,
			tags: [1, 2]
		},
		author: {
			id: 1,
			username: 'jdoe',
			name: { first: 'John', last: 'Doe' },
		},
		tags: [
			{
				id: 1,
				title: 'foo'
			},
			{
				id: 2,
				title: 'bar'
			}
		],
		input: 2
	})

})

test('will throw an error when fetching a query with circular dependencies', async () => {
	const store = new MemStore({
		users: [
			{
				id: 1,
				username: 'jdoe',
				name: { first: 'John', last: 'Doe' },
			},
			{
				id: 2,
				username: 'twaits',
				name: { first: 'Tom', last: 'Waits' },
			}
		],
		posts: [
			{
				id: 1,
				title: 'Post 1',
				content: 'This is the first post',
				author: 1,
				tags: [1]
			},
			{
				id: 2,
				title: 'Post 2',
				content: 'This is the second post',
				author: 1,
				tags: [1, 2]
			}
		]
	})

	const Posts = new Source(store, 'posts')
	const Users = new Source(store, 'users')

	const model = {
		getSource(name) {
			switch (name) {
				case 'post':
					return Posts
				case 'author':
					return Users
			}
		}
	}

	const populations = [
		{
			name: 'post',
			operation: 'read',
			require: ['author'],
			selector: ({ input }) => ({ id: input })
		},
		{
			name: 'author',
			operation: 'read',
			require: ['post'],
			selector: ({ post }) => {
				return { id: post.author }
			}
		}
	]

	const query = new Query()
	populations.forEach(p => query.addPopulation(p))

	await expect(query.exec(model, 1)).rejects.toHaveProperty('message', 'Cannot fetch a query with circular `require`s')
})