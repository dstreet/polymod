# Polymod

A library for composing data models from any number of sources.

## Install

```
npm install --save polymod
```

## Example

```javascript
const { Model, Query, Schema, MemStore } = require('polymod')

const data = {
	customers: [
		{
			id: 1,
			name: { first: 'John', last: 'Smith' },
			address: {
				street: '300 BOYLSTON AVE E',
				city: 'SEATTLE',
				state: 'WA',
				zip: 98012
			}
		}
	],
	products: [
		{
			id: 1,
			title: 'You Don\'t Know JS: Up & Going',
			isbn: '1491924462',
			price: 4.99
		},
		{
			id: 2,
			title: 'JavaScript: The Good Parts',
			isbn: '0596517742',
			price: 21.93
		}
	],
	orders: [
		{
			id: 1,
			dateCreated: '2017-01-01',
			datePayed: null,
			shipped: false,
			customer: 1,
			products: [1, 2]
		}
	]
}

const store = new MemStore(data)
const CustomersSchema = new Schema(store, 'customers', 'id')
const OrdersSchema = new Schema(store, 'orders', 'id')
const ProductsSchema = new Schema(store, 'products', 'id')

const OrderDetail = Model
	.create()

	// Add data sources
	.addBoundSource('order', OrdersSchema)
	.addSource('customer', CustomersSchema)
	.addSource('products', ProductsSchema)

	// Set the default query
	.addQuery('default',
		Query
			.create()

			// Procss query input
			.input(id => ({ order: { id } }))

			// Populate the data sources 
			.populate('order', ({ order }) => ({ id: order.id }))
			.populate('customer', ({ order }) => ({ id: order.customer }))
			.populate('products', ({ order }) => order.products.map(product => ({ id: product })))
	)

	// Create a mutation to remove a product by its title
	.addMutation('removeProductByTitle', (title, sources) => {
		const productIds = [...sources.order.products]
		const index = sources.order.products.findIndex(product => product.title === title)

		productIds.splice(index, 1)

		return [
			{ source: 'order', data: { products: productIds } }
		]
	})

	// Map the data sources to a document
	.map(({ order, customer, products }) => ({
		shipped: order.shipped,
		date: {
			created: order.dateCreated,
			payed: order.datePayed
		},
		customer: {
			name: customer.name,
			address: customer.address
		},
		products: products.map(product => ({
			title: product.title,
			price: product.price
		})),
		total: products.reduce((total, product) => total + product.price, 0)
	}))
```

### Get a model document

```javascript
const order = await OrderDetail.get(1)
```
Result:
```javascript
{
	shipped: false,
	date: {
		created: '2017-01-01',
		payed: null
	},
	customer: {
		name: { first: 'John', last: 'Smith' },
		adddress: {
			street: '300 BOYLSTON AVE E',
			city: 'SEATTLE',
			state: 'WA',
			zip: 98012
		}
	},
	products: [
		{
			title: 'You Don\'t Know JS: Up & Going',
			price: 4.99
		},
		{
			title: 'JavaScript: The Good Parts',
			price: 21.93
		}
	],
	total: 26.92
}
```

### Mutate a document

```javascript
await order.mutate('removeProductByTitle', 'JavaScript: The Good Parts')
```
Result:
```javascript
{
	...
	products: [
		{
			title: 'You Don\'t Know JS: Up & Going',
			price: 4.99
		}
	],
	total: 4.99
	...
}
```

### Delete a document

```javascript
await order.del()
```

Result:
```javascript
[
	{
		source: 'order',
		deleted: [
			{
				id: 1,
				dateCreated: '2017-01-01',
				datePayed: null,
				shipped: false,
				customer: 1,
				products: [1, 2]
			}
		]
	}
]
```

### Create a new document

```javascript
const newOrder = await OrderDetail.create({
	customer: 1,
	products: [2],
	shipped: true,
	date: {
		created: '2017-01-02',
		payed: '2017-02-10'
	}
})
```

Result:
```javascript
{
	shipped: false,
	date: {
		created: '2017-01-01',
		payed: '2017-02-10'
	},
	customer: {
		name: { first: 'John', last: 'Smith' },
		adddress: {
			street: '300 BOYLSTON AVE E',
			city: 'SEATTLE',
			state: 'WA',
			zip: 98012
		}
	},
	products: [
		{
			title: 'JavaScript: The Good Parts',
			price: 21.93
		}
	],
	total: 21.93
}
```

### Perform additional queries

```javascript
OrderDetail
	// Add a new source to get an array of orders
	.addSource('orders', [OrdersSchema])
	.addQuery('withProduct',
		Query
			// Return multiple documents
			.create(true)
			.input(id => ({ productId: id }))
			.populate('orders', ({ productId }) => ({ products: productId }))
			.populate('customer', ({ orders }) => orders.map(order => ({ id: order.customer })))
			.populate('products', ({ orders }) => {
				return orders.reduce((acc, order) => {
					return acc.concat(
						order.products.map(p => ({ id: p }))
					)
				}, [])
			})
			// Get an array of objects used to construct documents
			.map(({ orders, customer , products }) => {
				return orders.map((order, i) => ({
					order,
					customer: customer[i],
					products: order.products.map(id => products.find(product => product.id === id))
				}))
			})
	)

OrderDetail.query('withProduct', 1)
```

Result:
```javascript
[
	{
		shipped: false,
		date: {
			created: '2017-01-01',
			payed: null
		},
		customer: {
			name: { first: 'John', last: 'Smith' },
			adddress: {
				street: '300 BOYLSTON AVE E',
				city: 'SEATTLE',
				state: 'WA',
				zip: 98012
			}
		},
		products: [
			{
				title: 'You Don\'t Know JS: Up & Going',
				price: 4.99
			},
			{
				title: 'JavaScript: The Good Parts',
				price: 21.93
			}
		],
		total: 26.92
	}
]
```

## Tests

```
npm test
```

## License

This project is licensed under the [MIT license](LICENSE)