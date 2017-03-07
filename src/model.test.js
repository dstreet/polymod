/* eslint-env jest */
const Model = require('./model')
const Schema = require('./schema')
const Field = require('./field')
const Document = require('./document')
const MemStore = require('../src/mem-store')

const now = new Date()

test('', async () => {
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
		tags: [
			{ id: 1, title: 'Sevr', dateCreated: now },
			{ id: 2, title: 'MongoDB', dateCreated: now },
			{ id: 3, title: 'React', dateCreated: now }
		],
		posts: [
			{
				id: 1,
				title: 'Post 1',
				content: 'This is the first post',
				dateCreated: now,
				author: 1,
				tags: [1, 2]
			},
			{
				id: 2,
				title: 'Post 2',
				content: 'This is the second post',
				dateCreated: now,
				author: 1,
				tags: [3]
			}
		]
	})

	const PostsSchema = new Schema(storage, 'posts', 'id')
	const UsersSchema = new Schema(storage, 'users', 'id')
	const TagsSchema = new Schema(storage, 'tags', 'id')

	const PostDate = Model
		.create({
			created: Field.FromSchemaField(PostsSchema, 'dateCreated')
		})

	const Post = Model
		.create({
			title: Field.FromSchemaField(PostsSchema, 'title'),
			content: Field.FromSchemaField(PostsSchema, 'content'),
			author: Field.LinkDocument(
				{ schema: PostsSchema },
				{ schema: UsersSchema },
				'author',
				user => ({ username: user.username, name: user.name }),
				'ONE_TO_ONE'
			),
			tags: Field.LinkDocument(
				{ schema: PostsSchema },
				{ schema: TagsSchema },
				'tags',
				tag => tag.title,
				'ONE_TO_MANY'
			),
			date: PostDate.asField()
		})
		.mutation('pushTag', (doc, newTag) => {
			const fieldDoc = doc.getFieldDocument('tags')
			
			return {
				tags: fieldDoc.tags.concat(newTag)
			}
		})

	const document = await Post.get(1)

	expect(document instanceof Document).toBeTruthy()
	expect(document.get('title')).toBe('Post 1')
	expect(document.get('content')).toBe('This is the first post')
	expect(document.get('author')).toEqual({
		username: 'jdoe',
		name: { first: 'John', last: 'Doe' }
	})
	expect(document.get('tags')).toEqual(['Sevr', 'MongoDB'])

	await document.set('title', 'Updated post')
	expect(document.get('title')).toBe('Updated post')
	expect(storage._data.posts[0].title).toBe('Post 1')

	await document.commit()
	expect(storage._data.posts[0].title).toBe('Updated post')

	await document.set('author', 2)
	expect(document.get('author')).toEqual({
		username: 'twaits',
		name: { first: 'Tom', last: 'Waits' }
	})

	await document.commit()
	expect(storage._data.posts[0].author).toBe(2)

	await document.set('tags', [1, 3])
	expect(document.get('tags')).toEqual(['Sevr', 'React'])

	await document.commit()
	expect(storage._data.posts[0].tags).toEqual([1, 3])

	await document.mutate('pushTag', 2)
	expect(document.get('tags')).toEqual(['Sevr', 'React', 'MongoDB'])

	expect(document.get('date') instanceof Document).toBeTruthy()
	expect(document.get('date').get('created')).toEqual(now)

	const now2 = new Date()
	await document.get('date').set('created', now2)
	expect(document.get('date') instanceof Document).toBeTruthy()
	expect(document.get('date').get('created')).toEqual(now2)

	await document.commit()
	expect(storage._data.posts[0].dateCreated).toEqual(now2)
})

test('', async () => {
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
				author: 1,
				tags: [1, 2]
			},
			{
				id: 2,
				title: 'Post 2',
				content: 'This is the second post',
				dateCreated: now,
				author: 1,
				tags: [3]
			}
		]
	})

	const PostsSchema = new Schema(storage, 'posts', 'id')
	const UsersSchema = new Schema(storage, 'users', 'id')

	const AuthorPost = Model
		.create({
			title: Field.FromSchemaField(PostsSchema, 'title', 'author'),
			content: Field.FromSchemaField(PostsSchema, 'content', 'author')
		})

	const Author = Model
		.create({
			username: Field.FromSchemaField(UsersSchema, 'username'),
			name: Field.FromSchemaField(UsersSchema, 'name'),
			posts: AuthorPost.asField(true)
		})

	const document = await Author.get(1)

	expect(document.get('username')).toEqual('jdoe')
	expect(document.get('name')).toEqual({ first: 'John', last: 'Doe' })
	expect(document.get('posts')[0].get('title')).toEqual('Post 1')
	expect(document.get('posts')[1].get('title')).toEqual('Post 2')
})

test('', async () => {
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
				author: 1,
				tags: [1, 2]
			},
			{
				id: 2,
				title: 'Post 2',
				content: 'This is the second post',
				dateCreated: now,
				author: 1,
				tags: [3]
			}
		]
	})

	const PostsSchema = new Schema(storage, 'posts', 'id')
	const UsersSchema = new Schema(storage, 'users', 'id')

	const Post = Model
		.create({
			title: Field.FromSchemaField(PostsSchema, 'title'),
			content: Field.FromSchemaField(PostsSchema, 'content'),
			author: Field.LinkDocument(
				{ schema: PostsSchema },
				{ schema: UsersSchema },
				'author',
				user => ({ username: user.username, name: user.name }),
				'ONE_TO_ONE'
			),
		})

	const doc = await Post.get(1)

	expect(doc.schemaRefMap.length).toBe(1)
	expect(doc.schemaRefMap[0].document).toEqual(
		{
			id: 1,
			title: 'Post 1',
			content: 'This is the first post',
			dateCreated: now,
			author: 1,
			tags: [1, 2]
		}
	)
	expect(doc.get('title')).toEqual('Post 1')

	// Setting a value should update the document state,
	// but should not update the reference documents
	await doc.set('title', 'Updated post')
	expect(doc.get('title')).toEqual('Updated post')
	expect(doc.fields.title.referenceDocument).toEqual(
		{
			id: 1,
			title: 'Post 1',
			content: 'This is the first post',
			dateCreated: now,
			author: 1,
			tags: [1, 2]
		}
	)

	// Committing the data should update the reference documents
	// and commit the data to the store
	await doc.commit()
	expect(doc.fields.title.referenceDocument).toEqual(
		{
			id: 1,
			title: 'Updated post',
			content: 'This is the first post',
			dateCreated: now,
			author: 1,
			tags: [1, 2]
		}
	)
	expect(storage._data.posts[0]).toEqual({
		id: 1,
		title: 'Updated post',
		content: 'This is the first post',
		dateCreated: now,
		author: 1,
		tags: [1, 2]
	})

	// Should be able to create a new model document
	const newDoc = Post.create()
	expect(newDoc instanceof Document).toBeTruthy()
	expect(newDoc.fields).toHaveProperty('title')
	expect(newDoc.fields).toHaveProperty('content')
	
	await newDoc.set({
		title: 'Post 3',
		content: 'This is the third post'
	})
	expect(newDoc.get('title')).toEqual('Post 3')
	expect(newDoc.get('content')).toEqual('This is the third post')

	// When committing the new document, the data should be saved in the store
	// and the reference document select should be updated to match the newly
	// created document
	await newDoc.commit()
	expect(storage._data.posts[2]).toHaveProperty('title', 'Post 3')
	expect(storage._data.posts[2]).toHaveProperty('content', 'This is the third post')
	expect(newDoc.schemaRefMap[0].select).toHaveProperty('id')

	await newDoc.set({
		title: 'Here we go again',
		author: 1
	})
	expect(newDoc.get('title')).toEqual('Here we go again')
	expect(newDoc.get('author')).toEqual({
		username: 'jdoe',
		name: { first: 'John', last: 'Doe' }
	})

	await newDoc.commit()
	expect(storage._data.posts[2]).toHaveProperty('title', 'Here we go again')
	expect(storage._data.posts[2]).toHaveProperty('author', 1)
})