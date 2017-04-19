/* eslint-env jest */
const Model = require('./model')
const Schema = require('./schema')
const Document = require('./document')
const Query = require('./query')
const MemStore = require('../src/mem-store')

const now = new Date()

describe('single source', async () => {
	test('get()', async () => {
		const storage = new MemStore({
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now
				},
				{
					id: 2,
					title: 'Post 2',
					content: 'This is the second post',
					dateCreated: now
				}
			]
		})
		const PostsSchema = new Schema(storage, 'posts', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema)
			.describe({
				title: {
					type: String,
					data: ({ post }) => post.title
				},
				content: {
					type: String,
					data: ({ post }) => post.content
				},
				date: {
					type: {
						created: Date	
					},
					data: ({ post }) => ({
						created: post.dateCreated
					})
				}
			})
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}))
					.populate('post', ({ post }) => ({ id: post.id }))
			)

		const doc = await Post.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now }
		})
	})

	test('mutate() - unnamed', async () => {
		const storage = new MemStore({
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now
				},
				{
					id: 2,
					title: 'Post 2',
					content: 'This is the second post',
					dateCreated: now
				}
			]
		})
		const PostsSchema = new Schema(storage, 'posts', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema)
			.describe({
				title: {
					type: String,
					data: ({ post }) => post.title,
					mutation: {
						method: { source: 'post', data: title => ({ title }) }
					}
				},
				content: {
					type: String,
					data: ({ post }) => post.content,
					mutation: {
						method: [{ source: 'post', data: content => ({ content }) }]
					}
				},
				date: {
					type: { created: Date },
					data: ({ post }) => ({
						created: post.dateCreated
					})
				}
			})
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}))
					.populate('post', ({ post }) => ({ id: post.id }))
			)

		let doc = await Post.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now }
		})

		let [ document ] = await doc.mutate({
			title: 'Updated Title',
			content: 'This is the first post'
		})
		
		expect(document instanceof Document).toBeTruthy()
		expect(document.data).toEqual({
			title: 'Updated Title',
			content: 'This is the first post',
			date: { created: now }
		})
	})

	test('mutate() - named', async () => {
		const storage = new MemStore({
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now
				},
				{
					id: 2,
					title: 'Post 2',
					content: 'This is the second post',
					dateCreated: now
				}
			]
		})
		const PostsSchema = new Schema(storage, 'posts', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema)
			.map(({ post }) => ({
				title: post.title,
				content: post.content,
				date: { created: post.dateCreated }
			}))
			.addMutation('updateTitle', [
				{ source: 'post', data: title => ({ title }) }
			])
			.addMutation('updateAll', [
				{ source: 'post', data: data => ({ title: data.title, content: data.content, dateCreated: data.date.created }) }
			])
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}))
					.populate('post', ({ post }) => ({ id: post.id }))
			)

		let doc = await Post.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now }
		})

		let [ doc1 ] = await doc.mutate('updateTitle', 'Updated Title')
		expect(doc1 instanceof Document).toBeTruthy()
		expect(doc1.data).toEqual({
			title: 'Updated Title',
			content: 'This is the first post',
			date: { created: now }
		})

		const now2 = new Date()
		let [ doc2 ] = await doc1.mutate('updateAll', {
			title: 'Updated Again',
			content: 'Look at me!',
			date: { created: now2 }
		})
		expect(doc2 instanceof Document).toBeTruthy()
		expect(doc2.data).toEqual({
			title: 'Updated Again',
			content: 'Look at me!',
			date: { created: now2 }
		})
	})

	test('del()', async () => {
		const storage = new MemStore({
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now
				},
				{
					id: 2,
					title: 'Post 2',
					content: 'This is the second post',
					dateCreated: now
				}
			]
		})
		const PostsSchema = new Schema(storage, 'posts', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema)
			.map(({ post }) => ({
				title: post.title,
				content: post.content,
				date: { created: post.dateCreated }
			}))
			.bindSources(['post'])
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}))
					.populate('post', ({ post }) => ({ id: post.id }))
			)

		let doc = await Post.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now }
		})

		let deleted = await Post.del(1)
		expect(deleted).toEqual([
			{
				source: 'post',
				deleted: [{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now
				}]
			}
		])
	})

	test('create()', async () => {
		const storage = new MemStore({
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now
				},
				{
					id: 2,
					title: 'Post 2',
					content: 'This is the second post',
					dateCreated: now
				}
			]
		})
		const PostsSchema = new Schema(storage, 'posts', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema)
			.describe({
				title: {
					type: String,
					data: ({ post }) => post.title,
					mutation: {
						method: { source: 'post', data: title => ({ title }) }
					}
				},
				content: {
					type: String,
					data: ({ post }) => post.content,
					mutation: {
						method: { source: 'post', data: content => ({ content }) }
					}
				},
				date: {
					type: {
						created: Date	
					},
					data: ({ post }) => ({
						created: post.dateCreated
					}),
					mutation: {
						method: { source: 'post', data: date => ({ dateCreated: date.created }) }
					},
					default: () => ({ created: now })
				}
			})
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}), ({ post }) => post.id)
					.populate('post', ({ post }) => ({ id: post.id }))
			)

		let doc = await Post.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now }
		})
		
		let [ document ] = await Post.create({
			title: 'New Post',
			content: 'New post content'
		})
		expect(document instanceof Document).toBeTruthy()
		expect(document.data).toHaveProperty('title', 'New Post')
		expect(document.data).toHaveProperty('content', 'New post content')
		expect(document.data).toHaveProperty('date.created', now)
	})

	test('query()', async () => {
		const storage = new MemStore({
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now
				},
				{
					id: 2,
					title: 'Post 2',
					content: 'This is the second post',
					dateCreated: now
				}
			]
		})
		const PostsSchema = new Schema(storage, 'posts', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema)
			.map(({ post }) => ({
				title: post.title,
				content: post.content,
				date: { created: post.dateCreated }
			}))
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id } }))
					.populate('post', ({ post }) => ({ id: post.id }))
			)

		const doc = await Post.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now }
		})
	})

	test('describe()', async () => {
		const storage = new MemStore()
		const PostsSchema = new Schema(storage, 'posts', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema)
			.describe({
				title: {
					type: String,
					data: ({ post }) => post.title,
					mutation: {
						method: { source: 'post', data: title => ({ title }) }
					}
				},
				content: {
					type: String,
					meta: {
						label: 'Content',
						description: 'Post content'
					},
					data: ({ post }) => post.content
				},
				date: {
					type: {
						created: Date	
					},
					data: ({ post }) => ({
						created: post.dateCreated
					})
				}
			})
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}))
					.populate('post', ({ post }) => ({ id: post.id }))
			)

		expect(Post.describe()).toEqual({
			title: {
				type: String,
				mutable: true
			},
			content: {
				type: String,
				meta: {
					label: 'Content',
					description: 'Post content'
				},
				mutable: false
			},
			date: {
				type: { created: Date },
				mutable: false
			}
		})
	})
})

describe('multiple sources', async () => {
	test('get()', async () => {
		const storage = new MemStore({
			users: [
				{
					id: 1,
					username: 'jdoe',
					name: { first: 'John', last: 'Doe' },
					dateCreated: now
				},
				{
					id: 2,
					username: 'twaits',
					name: { first: 'Tom', last: 'Waits' },
					dateCreated: now
				}
			],
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now,
					author: 1
				},
				{
					id: 2,
					title: 'Post 2',
					content: 'This is the second post',
					dateCreated: now,
					author: 1
				}
			]
		})

		const PostsSchema = new Schema(storage, 'posts', 'id')
		const UsersSchema = new Schema(storage, 'users', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema)
			.addSource('author', UsersSchema)
			.map(({ post, author }) => ({
				title: post.title,
				content: post.content,
				date: { created: post.dateCreated },
				author: {
					username: author.username,
					name: author.name
				}
			}))
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}))
					.populate('post', ({ post }) => ({ id: post.id }))
					.populate('author', ({ post }) => ({ id: post.author }))
			)
			
		const doc = await Post.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now },
			author: {
				username: 'jdoe',
				name: { first: 'John', last: 'Doe' }
			}
		})
	})

	test('mutate()', async () => {
		const storage = new MemStore({
			users: [
				{
					id: 1,
					username: 'jdoe',
					name: { first: 'John', last: 'Doe' },
					dateCreated: now
				},
				{
					id: 2,
					username: 'twaits',
					name: { first: 'Tom', last: 'Waits' },
					dateCreated: now
				}
			],
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now,
					author: 1
				},
				{
					id: 2,
					title: 'Post 2',
					content: 'This is the second post',
					dateCreated: now,
					author: 1
				}
			]
		})

		const PostsSchema = new Schema(storage, 'posts', 'id')
		const UsersSchema = new Schema(storage, 'users', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema)
			.addSource('author', UsersSchema)
			.describe({
				title: {
					type: String,
					data: ({ post }) => post.title
				},
				content: {
					type: String,
					data: ({ post }) => post.content
				},
				date: {
					type: {
						created: { type: Date }
					},
					data: ({ post }) => ({
						created: post.dateCreated
					})
				},
				author: {
					type: {
						username: String,
						name: { first: String, last: String }
					},
					data: ({ author }) => ({
						username: author.username,
						name: author.name
					}),
					mutation: {
						type: Number,
						method: { source: 'post', data: id => ({ author: id }) }
					}
				}
			})
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}))
					.populate('post', ({ post }) => ({ id: post.id }))
					.populate('author', ({ post }) => ({ id: post.author }))
			)
			
		let doc = await Post.get(1)
		
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now },
			author: {
				username: 'jdoe',
				name: { first: 'John', last: 'Doe' }
			}
		})

		let [ document ] = await doc.mutate({
			author: 2
		})
		
		expect(document instanceof Document).toBeTruthy()
		expect(document.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now },
			author: {
				username: 'twaits',
				name: { first: 'Tom', last: 'Waits' }
			}
		})
	})

	test('del()', async () => {
		const storage = new MemStore({
			users: [
				{
					id: 1,
					username: 'jdoe',
					name: { first: 'John', last: 'Doe' },
					dateCreated: now
				},
				{
					id: 2,
					username: 'twaits',
					name: { first: 'Tom', last: 'Waits' },
					dateCreated: now
				}
			],
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now,
					author: 1
				},
				{
					id: 2,
					title: 'Post 2',
					content: 'This is the second post',
					dateCreated: now,
					author: 1
				}
			]
		})

		const PostsSchema = new Schema(storage, 'posts', 'id')
		const UsersSchema = new Schema(storage, 'users', 'id')

		const Post = Model
			.create()
			.addBoundSource('post', PostsSchema)
			.addSource('author', UsersSchema)
			.map(({ post, author }) => ({
				title: post.title,
				content: post.content,
				date: { created: post.dateCreated },
				author: {
					username: author.username,
					name: author.name
				}
			}))
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}))
					.populate('post', ({ post }) => ({ id: post.id }))
					.populate('author', ({ post }) => ({ id: post.author }))
			)
			
		const doc = await Post.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now },
			author: {
				username: 'jdoe',
				name: { first: 'John', last: 'Doe' }
			}
		})

		const deleted = await doc.del()
		expect(deleted).toEqual([
			{
				source: 'post',
				deleted: [{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now,
					author: 1
				}]
			}
		])
	})

	test('create()', async () => {
		const storage = new MemStore({
			users: [
				{
					id: 1,
					username: 'jdoe',
					name: { first: 'John', last: 'Doe' },
					dateCreated: now
				},
				{
					id: 2,
					username: 'twaits',
					name: { first: 'Tom', last: 'Waits' },
					dateCreated: now
				}
			],
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now,
					author: 1
				},
				{
					id: 2,
					title: 'Post 2',
					content: 'This is the second post',
					dateCreated: now,
					author: 1
				}
			]
		})

		const PostsSchema = new Schema(storage, 'posts', 'id')
		const UsersSchema = new Schema(storage, 'users', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema)
			.addSource('author', UsersSchema)
			.describe({
				title: {
					type: String,
					data: ({ post }) => post.title,
					mutation: {
						method: { source: 'post', data: title => ({ title }) }
					}
				},
				content: {
					type: String,
					data: ({ post }) => post.content,
					mutation: {
						method: { source: 'post', data: content => ({ content }) }
					}
				},
				date: {
					type: {
						created: Date	
					},
					data: ({ post }) => ({
						created: post.dateCreated
					}),
					mutation: {
						method: { source: 'post', data: date => ({ dateCreated: date.created }) }
					},
					default: () => ({ created: now })
				},
				author: {
					type: {
						username: String,
						name: { first: String, last: String }
					},
					data: ({ author }) => ({
						username: author.username,
						name: author.name
					}),
					mutation: {
						type: Number,
						method: { source: 'post', data: id => ({ author: id }) }
					}
				}
			})
			.addQuery('default',
				Query
					.create()
					.input(
						id => ({ post: { id }}),
						({ post }) => post.id
					)
					.populate('post', ({ post }) => ({ id: post.id }))
					.populate('author', ({ post }) => ({ id: post.author }))
			)
			
		let doc = await Post.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now },
			author: {
				username: 'jdoe',
				name: { first: 'John', last: 'Doe' }
			}
		})

		let [ document ] = await Post.create({
			title: 'New Post',
			content: 'New post content',
			author: 2
		})
		expect(document.data).toHaveProperty('title', 'New Post')
		expect(document.data).toHaveProperty('content', 'New post content')
		expect(document.data).toHaveProperty('date.created', now)
		expect(document.data).toHaveProperty('author', {
			username: 'twaits',
			name: { first: 'Tom', last: 'Waits' }
		})
	})

	test('query()', async () => {
		const storage = new MemStore({
			users: [
				{
					id: 1,
					username: 'jdoe',
					name: { first: 'John', last: 'Doe' },
					dateCreated: now
				},
				{
					id: 2,
					username: 'twaits',
					name: { first: 'Tom', last: 'Waits' },
					dateCreated: now
				}
			],
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now,
					author: 1
				},
				{
					id: 2,
					title: 'Post 2',
					content: 'This is the second post',
					dateCreated: now,
					author: 1
				}
			]
		})

		const PostsSchema = new Schema(storage, 'posts', 'id')
		const UsersSchema = new Schema(storage, 'users', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema)
			.addSource('posts', [PostsSchema])
			.addSource('author', UsersSchema)
			.map(({ post, author }) => ({
				title: post.title,
				content: post.content,
				date: { created: post.dateCreated },
				author: {
					username: author.username,
					name: author.name
				}
			}))
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}))
					.populate('post', ({ post }) => ({ id: post.id }))
					.populate('author', ({ post }) => ({ id: post.author }))
			)
			.addQuery('byAuthor',
				Query
					.create(true)
					.input(id => ({ author: { id } }))
					.populate('posts', ({ author }) => ({ author: author.id }))
					.populate('author', ({ author }) => ({ id: author.id }))
					.map(({ author, posts }) => posts.map(post => ({ post, author })))
			)
			
		const docs = await Post.query('byAuthor', 1)
		expect(docs).toHaveLength(2)
		expect(docs[0].data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now },
			author: {
				username: 'jdoe',
				name: { first: 'John', last: 'Doe' }
			}
		})
		expect(docs[1].data).toEqual({
			title: 'Post 2',
			content: 'This is the second post',
			date: { created: now },
			author: {
				username: 'jdoe',
				name: { first: 'John', last: 'Doe' }
			}
		})
	})
})

describe('array source', async () => {
	test('get()', async () => {
		const storage = new MemStore({
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now
				}
			],
			tags: [
				{ id: 1, title: 'Sevr', dateCreated: now },
				{ id: 2, title: 'MongoDB', dateCreated: now },
				{ id: 3, title: 'React', dateCreated: now }
			],
			postTags: [
				{ id: 1, post: 1, tag: 1 },
				{ id: 1, post: 1, tag: 2 },
				{ id: 1, post: 2, tag: 3 }
			]
		})
		const PostsSchema = new Schema(storage, 'posts', 'id')
		const TagsSchema = new Schema(storage, 'tags', 'id')
		const PostTagsSchema = new Schema(storage, 'postTags', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema,)
			.addSource('tagLinks', [PostTagsSchema])
			.addSource('tags', TagsSchema)
			.map(({ post, tags }) => ({
				title: post.title,
				content: post.content,
				date: { created: post.dateCreated },
				tags: tags.map(tag => tag.title)
			}))
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}))
					.populate('post', ({ post }) => ({ id: post.id }))
					.populate('tagLinks', ({ post }) => ({ post: post.id }))
					.populate('tags', ({ tagLinks }) => tagLinks.map(link => ({ id: link.tag })))
			)

		const doc = await Post.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now },
			tags: ['Sevr', 'MongoDB']
		})
	})

	test('mutate()', async () => {
		const storage = new MemStore({
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now
				}
			],
			tags: [
				{ id: 1, title: 'Sevr', dateCreated: now },
				{ id: 2, title: 'MongoDB', dateCreated: now },
				{ id: 3, title: 'React', dateCreated: now }
			],
			postTags: [
				{ id: 1, post: 1, tag: 1 },
				{ id: 1, post: 1, tag: 2 },
				{ id: 1, post: 2, tag: 3 }
			]
		})
		const PostsSchema = new Schema(storage, 'posts', 'id')
		const TagsSchema = new Schema(storage, 'tags', 'id')
		const PostTagsSchema = new Schema(storage, 'postTags', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema)
			.addSource('tagLinks', [PostTagsSchema])
			.addSource('tags', TagsSchema)
			.describe({
				title: {
					type: String,
					data: ({ post }) => post.title
				},
				content: {
					type: String,
					data: ({ post }) => post.content
				},
				date: {
					type: {
						created: Date	
					},
					data: ({ post }) => ({
						created: post.dateCreated
					})
				},
				tags: {
					type: [String],
					data: ({ tags }) => tags.map(tag => tag.title),
					mutation: {
						type: [Number],
						method: [
							{ source: 'tagLinks', data: (tags, { post }) => ({ post: post.id }), operation: 'delete' },
							{ source: 'tagLinks', data: (tags, { post }) => tags.map(tag => ({ post: post.id, tag })), operation: 'create' }
						]
					}
				}
			})
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}))
					.populate('post', ({ post }) => ({ id: post.id }))
					.populate('tagLinks', ({ post }) => ({ post: post.id }))
					.populate('tags', ({ tagLinks }) => tagLinks.map(link => ({ id: link.tag })))
			)
			.addMutation('pushTag', [
				{ source: 'tagLinks', data: (id, { post }) => ({ post: post.id, tag: id }), operation: 'create' }
			])

		let doc = await Post.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now },
			tags: ['Sevr', 'MongoDB']
		})

		let [ doc1 ] = await doc.mutate('pushTag', 3)
		expect(doc1 instanceof Document).toBeTruthy()
		expect(doc1.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now },
			tags: ['Sevr', 'MongoDB', 'React']
		})

		let [ doc2 ] = await doc1.mutate({
			tags: [1, 2]
		})
		expect(doc2 instanceof Document).toBeTruthy()
		expect(doc2.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now },
			tags: ['Sevr', 'MongoDB']
		})
	})

	test('del()', async () => {
		const storage = new MemStore({
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now
				}
			],
			tags: [
				{ id: 1, title: 'Sevr', dateCreated: now },
				{ id: 2, title: 'MongoDB', dateCreated: now },
				{ id: 3, title: 'React', dateCreated: now }
			],
			postTags: [
				{ id: 1, post: 1, tag: 1 },
				{ id: 1, post: 1, tag: 2 },
				{ id: 1, post: 2, tag: 3 }
			]
		})
		const PostsSchema = new Schema(storage, 'posts', 'id')
		const TagsSchema = new Schema(storage, 'tags', 'id')
		const PostTagsSchema = new Schema(storage, 'postTags', 'id')

		const Post = Model
			.create()
			.addBoundSource('post', PostsSchema,)
			.addBoundSource('tagLinks', [PostTagsSchema])
			.addSource('tags', TagsSchema)
			.map(({ post, tags }) => ({
				title: post.title,
				content: post.content,
				date: { created: post.dateCreated },
				tags: tags.map(tag => tag.title)
			}))
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}))
					.populate('post', ({ post }) => ({ id: post.id }))
					.populate('tagLinks', ({ post }) => ({ post: post.id }))
					.populate('tags', ({ tagLinks }) => tagLinks.map(link => ({ id: link.tag })))
			)

		const doc = await Post.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now },
			tags: ['Sevr', 'MongoDB']
		})

		const deleted = await doc.del()
		expect(deleted).toEqual([
			{
				source: 'post',
				deleted: [{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now
				}]
			},
			{
				source: 'tagLinks',
				deleted: [
					{ id: 1, post: 1, tag: 1 },
					{ id: 1, post: 1, tag: 2 }
				]
			}
		])
	})

	test('create()', async () => {
		const storage = new MemStore({
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now
				}
			],
			tags: [
				{ id: 1, title: 'Sevr', dateCreated: now },
				{ id: 2, title: 'MongoDB', dateCreated: now },
				{ id: 3, title: 'React', dateCreated: now }
			],
			postTags: [
				{ id: 1, post: 1, tag: 1 },
				{ id: 1, post: 1, tag: 2 },
				{ id: 1, post: 2, tag: 3 }
			]
		})
		const PostsSchema = new Schema(storage, 'posts', 'id')
		const TagsSchema = new Schema(storage, 'tags', 'id')
		const PostTagsSchema = new Schema(storage, 'postTags', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema,)
			.addSource('tagLinks', [PostTagsSchema])
			.addSource('tags', TagsSchema)
			.describe({
				title: {
					type: String,
					data: ({ post }) => post.title,
					mutation: {
						method: { source: 'post', data: title => ({ title }) }
					}
				},
				content: {
					type: String,
					data: ({ post }) => post.content,
					mutation: {
						method: { source: 'post', data: content => ({ content }) }
					}
				},
				date: {
					type: {
						created: Date	
					},
					data: ({ post }) => ({
						created: post.dateCreated
					}),
					mutation: {
						method: { source: 'post', data: date => ({ dateCreated: date.created }) }
					},
					default: () => ({ created: now })
				},
				tags: {
					type: [String],
					data: ({ tags }) => tags.map(tag => tag.title),
					mutation: {
						type: [Number],
						method: [
							{ source: 'tagLinks', data: (tags, { post }) => ({ post: post.id }), operation: 'delete' },
							{ source: 'tagLinks', data: (tags, { post }) => tags.map(tag => ({ post: post.id, tag })), operation: 'create' }
						]
					}
				}
			})
			.addQuery('default',
				Query
					.create()
					.input(
						input => ({ post: { id: input }}),
						({ post }) => post.id
					)
					.populate('post', ({ post }) => ({ id: post.id }))
					.populate('tagLinks', ({ post }) => ({ post: post.id }))
					.populate('tags', ({ tagLinks }) => tagLinks.map(link => ({ id: link.tag })))
			)

		let doc = await Post.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now },
			tags: ['Sevr', 'MongoDB']
		})

		let [ document ] = await Post.create({
			title: 'New Post',
			content: 'New post content',
			tags: [2, 3]
		})

		expect(document instanceof Document).toBeTruthy()
		expect(document.data).toHaveProperty('title', 'New Post')
		expect(document.data).toHaveProperty('content', 'New post content')
		expect(document.data).toHaveProperty('date.created', now)
		expect(document.data).toHaveProperty('tags', ['MongoDB', 'React'])
	})

	test('query()', async () => {
		const storage = new MemStore({
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now
				},
				{
					id: 2,
					title: 'Post 2',
					content: 'This is the second post',
					dateCreated: now
				}
			],
			tags: [
				{ id: 1, title: 'Sevr', dateCreated: now },
				{ id: 2, title: 'MongoDB', dateCreated: now },
				{ id: 3, title: 'React', dateCreated: now }
			],
			postTags: [
				{ id: 1, post: 1, tag: 1 },
				{ id: 1, post: 1, tag: 2 },
				{ id: 1, post: 2, tag: 1 }
			]
		})
		const PostsSchema = new Schema(storage, 'posts', 'id')
		const TagsSchema = new Schema(storage, 'tags', 'id')
		const PostTagsSchema = new Schema(storage, 'postTags', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema)
			.addSource('posts', PostsSchema)
			.addSource('tagLinks', [PostTagsSchema])
			.addSource('postLinks', [PostTagsSchema])
			.addSource('tags', TagsSchema)
			.map(({ post, tags }) => ({
				title: post.title,
				content: post.content,
				date: { created: post.dateCreated },
				tags: tags.map(tag => tag.title)
			}))
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}))
					.populate('post', ({ post }) => ({ id: post.id }))
					.populate('tagLinks', ({ post }) => ({ post: post.id }))
					.populate('tags', ({ tagLinks }) => tagLinks.map(link => ({ id: link.tag })))
			)
			.addQuery('withTag',
				Query
					.create(true)
					.input(tagId => ({ tag: { id: tagId } }))
					.populate('tagLinks', ({ tag }) => ({ tag: tag.id }))
					.populate('posts', ({ tagLinks }) => tagLinks.map(link => ({ id: link.post })))
					.populate('postLinks', ({ posts }) => posts.map(post => {
						return { post: post.id }
					}))
					.populate('tags', ({ postLinks }) => {
						return postLinks.reduce((acc, links) => {
							return acc.concat(
								links.map(link => ({ id: link.tag }))
							)
						}, [])
					})
					.map(({ posts, postLinks, tags }) => {
						return posts.map((post, p) => {
							return {
								post,
								tags: postLinks[p].map(link => tags.find(tag => tag.id === link.tag))
							}
						})
					})
			)

		const docs = await Post.query('withTag', 1)
		expect(docs).toHaveLength(2)
		expect(docs[0].data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now },
			tags: ['Sevr', 'MongoDB']
		})
		expect(docs[1].data).toEqual({
			title: 'Post 2',
			content: 'This is the second post',
			date: { created: now },
			tags: ['Sevr']
		})
	})
})

describe('validation', async () => {
	test('mutate() - unnamed', async() => {
		const storage = new MemStore({
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now
				},
				{
					id: 2,
					title: 'Post 2',
					content: 'This is the second post',
					dateCreated: now
				}
			]
		})
		const PostsSchema = new Schema(storage, 'posts', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema)
			.describe({
				title: {
					type: String,
					required: true,
					data: ({ post }) => post.title,
					mutation: {
						method: { source: 'post', data: title => ({ title }) }
					}
				},
				content: {
					type: String,
					data: ({ post }) => post.content,
					mutation: {
						method: { source: 'post', data: title => ({ title }) }
					}
				},
				date: {
					type: {
						created: Date	
					},
					data: ({ post }) => ({
						created: post.dateCreated
					}),
					mutation: {
						method: { source: 'post', data: date => ({ dateCreated: date.create }) }
					}
				}
			})
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}))
					.populate('post', ({ post }) => ({ id: post.id }))
			)

		expect.assertions(6)

		let doc = await Post.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now }
		})

		const [, error1 ] = await doc.mutate({ title: 1337 })
		expect(error1).toHaveProperty('err')
		expect(error1).toHaveProperty('data')

		const [, error2 ] = await doc.mutate({ content: '' })
		expect(error2.err.message).toBe('Invalid')
		expect(error2.data[0]).toHaveProperty('reason', 'optional')
	})

	test('mutate() - named', async() => {
		const storage = new MemStore({
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now
				},
				{
					id: 2,
					title: 'Post 2',
					content: 'This is the second post',
					dateCreated: now
				}
			]
		})
		const PostsSchema = new Schema(storage, 'posts', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema)
			.describe({
				title: {
					type: String,
					required: true,
					data: ({ post }) => post.title
				},
				content: {
					type: String,
					data: ({ post }) => post.content
				},
				date: {
					type: {
						created: Date	
					},
					data: ({ post }) => ({
						created: post.dateCreated
					})
				}
			})
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}))
					.populate('post', ({ post }) => ({ id: post.id }))
			)
			.addMutation('updateTitle', [
				{ source: 'post', data: title => ({ title }) }
			], String)

		expect.assertions(5)

		let doc = await Post.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now }
		})

		const [, error ] = await doc.mutate('updateTitle', 1337)
		expect(error.err.message).toBe('Invalid')
		expect(error).toHaveProperty('err')
		expect(error).toHaveProperty('data')
	})

	test('create()', async () => {
		const storage = new MemStore({
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now
				},
				{
					id: 2,
					title: 'Post 2',
					content: 'This is the second post',
					dateCreated: now
				}
			]
		})
		const PostsSchema = new Schema(storage, 'posts', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema)
			.describe({
				title: {
					type: String,
					data: ({ post }) => post.title,
					mutation: {
						method: { source: 'post', data: title => ({ title }) }
					}
				},
				content: {
					type: String,
					data: ({ post }) => post.content,
					mutation: {
						method: { source: 'post', data: content => ({ content }) }
					}
				},
				date: {
					type: {
						created: Date	
					},
					data: ({ post }) => ({
						created: post.dateCreated
					}),
					mutation: {
						method: { source: 'post', data: date => ({ dateCreated: date.created }) }
					},
					default: () => ({ created: now })
				}
			})
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}), ({ post }) => post.id)
					.populate('post', ({ post }) => ({ id: post.id }))
			)

		expect.assertions(5)

		let doc = await Post.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now }
		})
		
		const [, error ] = await Post.create({
			title: 1337
		})
		expect(error.err.message).toBe('Invalid')
		expect(error).toHaveProperty('err')
		expect(error).toHaveProperty('data')
	})

	test('No type definitions', async() => {
		const storage = new MemStore({
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now
				},
				{
					id: 2,
					title: 'Post 2',
					content: 'This is the second post',
					dateCreated: now
				}
			]
		})
		const PostsSchema = new Schema(storage, 'posts', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema)
			.map(({ post }) => ({
				title: post.title,
				content: post.content,
				date: { created: post.dateCreated }
			}))
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}))
					.populate('post', ({ post }) => ({ id: post.id }))
			)

		let doc = await Post.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now }
		})

		const [ document ] = await doc.mutate({ title: 1337 })
		expect(document instanceof Document).toBeTruthy()
	})
})

describe('errors', async () => {
	test('return empty document if required sources fails', async () => {
		const storage = new MemStore({
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now
				}
			]
		})
		const PostsSchema = new Schema(storage, 'posts', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema)
			.describe({
				title: {
					type: String,
					data: ({ post }) => post.title
				},
				content: {
					type: String,
					data: ({ post }) => post.content
				},
				date: {
					type: {
						created: Date	
					},
					data: ({ post }) => ({
						created: post.dateCreated
					})
				}
			})
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}))
					.populate('post', ({ post }) => ({ id: post.id }))
			)

		const doc = await Post.get(3)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toBeUndefined()
	})

	test('throw an error when data map fails and no required sources', async () => {
		const storage = new MemStore({
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now
				}
			]
		})
		const PostsSchema = new Schema(storage, 'posts', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema, false)
			.describe({
				title: {
					type: String,
					data: ({ post }) => post.title
				},
				content: {
					type: String,
					data: ({ post }) => post.content
				},
				date: {
					type: {
						created: Date	
					},
					data: ({ post }) => ({
						created: post.dateCreated
					})
				}
			})
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}))
					.populate('post', ({ post }) => ({ id: post.id }))
			)
		
		expect.assertions(1)

		try {
			await Post.get(3)
		} catch (err) {
			expect(err.message).toEqual('Failed to create document')
		}
	})
})

describe('property access', async () => {
	test('write-only properties', async () => {
		const storage = new MemStore({
			users: [
				{
					id: 1,
					username: 'jdoe',
					password: 'imasecret'
				}
			]
		})
		const UsersSchema = new Schema(storage, 'users')

		const User = Model
			.create()
			.addSource('user', UsersSchema)
			.describe({
				id: {
					type: Number,
					data: ({ user }) => user.id
				},
				username: {
					type: String,
					data: ({ user }) => user.username
				},
				password: {
					type: String,
					mutation: {
						method: { source: 'user', data: password => ({ password }) }
					}
				},
			})
			.addQuery('default',
				Query
					.create()
					.input(id => ({ user: { id }}))
					.populate('user', ({ user }) => ({ id: user.id }))
			)

		const doc = await User.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).not.toHaveProperty('password')

		const [doc2] = await doc.mutate({ password: 'password2' })
		expect(doc2 instanceof Document).toBeTruthy()
		expect(doc2.data).not.toHaveProperty('password')
		expect(storage._data.users[0].password).toBe('password2')
	})

	test.only('property not modifiable', async () => {
		const storage = new MemStore({
			tags: [
				{
					id: 1,
					title: 'React',
					slug: 'react'
				}
			]
		})
		const TagsSchema = new Schema(storage, 'tags')

		const Tag = Model
			.create()
			.addSource('tag', TagsSchema)
			.describe({
				id: {
					type: Number,
					data: ({ tag }) => tag.id
				},
				title: {
					type: String,
					data: ({ tag }) => tag.title,
					modify: false,
					mutation: {
						method: { source: 'tag', data: title => ({ title }) }
					}
				},
				slug: {
					type: String,
					data: ({ tag }) => tag.slug,
					mutation: {
						method: { source: 'tag', data: slug => ({ slug }) }
					}
				}
			})
			.addQuery('default',
				Query
					.create()
					.input(
						id => ({ tag: { id }}),
						({ tag }) => tag.id
					)
					.populate('tag', ({ tag }) => ({ id: tag.id }))
			)
		
		const doc = await Tag.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			id: 1,
			title: 'React',
			slug: 'react'
		})

		const [doc2] = await doc.mutate({ title: 'Polymod', slug: 'polymod' })
		expect(doc2.data).toEqual({
			id: 1,
			title: 'React',
			slug: 'polymod'
		})

		const [doc3, error] = await doc2.mutate('title', 'Polymod')
		expect(doc3).toBeUndefined()
		expect(error.err.message).toEqual('Property \'title\' cannot be modified')

		const [doc4] = await Tag.create({ title: 'Polymod', slug: 'polymod' })
		expect(doc4 instanceof Document).toBeTruthy()
		expect(doc4.data).toHaveProperty('title', 'Polymod')
		expect(doc4.data).toHaveProperty('slug', 'polymod')	
	})
})