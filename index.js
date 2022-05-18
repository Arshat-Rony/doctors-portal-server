const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken');
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
const { query } = require('express');
const { response } = require('express');
const ObjectId = require('mongodb').ObjectId;

const app = express()

const port = process.env.PORT || 5000;

// middleware 
app.use(cors())
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dlhdj.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


function verifyJwt(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).send({ message: "Unauthorrized access" })
    }
    else {
        const token = authHeader.split(' ')[1]
        jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
            if (err) {
                res.status(403).send({ message: "Forbidden Access" })
            }
            else {
                req.decoded = decoded;
                next()
            }
        })
    }
}

async function run() {
    try {
        await client.connect()
        const database = client.db('doctors_portal')
        const serviceCollection = database.collection('services')
        const bookingCollection = database.collection('bookings')
        const userCollection = database.collection('users')
        const doctorCollection = database.collection('doctors')





        const verifyAdmin = async (req, res, next) => {

            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester })
            if (requesterAccount.role === 'admin') {
                next()
                console.log("this")
            } else {
                res.status(403).send({ message: 'Forbidden' })
            }

        }



        // send user and if exist update the user to the backend
        app.put('/users/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email }
            const options = { upsert: true }
            const user = req.body;
            const updateDoc = {
                $set: user,
            }
            const result = await userCollection.updateOne(filter, updateDoc, options)
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, { expiresIn: "1d" })
            res.send({ result, token })
        })



        // make an Admin
        app.put('/users/admin/:email', verifyJwt, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email }
            const updateDoc = {
                $set: { role: 'admin' }
            }
            const result = await userCollection.updateOne(filter, updateDoc)
            res.send(result)
        })



        // check the user admin or not 
        app.get("/admin/:email", async (req, res) => {
            const email = req.params.email;
            const requester = await userCollection.findOne({ email: email })
            const isAdmin = requester.role === "admin";
            res.send({ admin: isAdmin })
        })



        // get all services 
        app.get('/services', async (req, res) => {
            const query = {}
            const cursor = serviceCollection.find(query).project({ name: 1 })
            const result = await cursor.toArray()
            res.send(result)
        })




        // get the data according to date and user 
        app.get('/available', async (req, res) => {
            // get all the services 
            const services = await serviceCollection.find().toArray()

            //  get the services of that day 
            const date = req.query.date;
            const bookings = await bookingCollection.find({ date }).toArray()


            services.forEach(service => {
                // check the bookings of that day 
                const serviceBookings = bookings.filter(b => b.treatment === service.name)

                // check the solts that are already booked for selected service 
                const booked = serviceBookings.map(b => b.slots)

                //remove the slot that aready booked 
                const availableSolts = service.slots.filter(s => !booked.includes(s))

                // make another array of availableSolts
                // service.available = availableSolts;
                // or fix existing array by this code  
                service.slots = availableSolts;

            })
            res.send(services)
        })

        // get the bookings according to email and user
        app.get('/bookings', verifyJwt, async (req, res) => {
            const user = req.query.patient;
            const decodedEmail = req.decoded.email;
            if (user === decodedEmail) {
                const query = { patientEmail: user }
                const result = await bookingCollection.find(query).toArray()
                res.send(result)
            }
            else {
                res.status(403).send({ message: "Forbidden Access" })
            }

        })




        //   get all users 
        app.get('/users', async (req, res) => {
            const result = await userCollection.find({}).toArray()
            res.send(result)
        })




        // send data to server 
        app.post('/bookings', async (req, res) => {
            const data = req.body;
            const query = { treatment: data.treatment, date: data.date, patient: data.patient }
            const exists = await bookingCollection.findOne(query)
            if (exists) {
                res.send({ success: false, exists })
            } else {
                const result = await bookingCollection.insertOne(data)
                res.send(result)
            }

        })


        // make a doctors collection 
        app.post("/doctors", verifyJwt, verifyAdmin, async (req, res) => {
            const doctor = req.body;
            const result = await doctorCollection.insertOne(doctor)
            res.send(result)
        })

        // get all the doctors 
        app.get("/doctors", async (req, res) => {
            const result = await doctorCollection.find({}).toArray()
            res.send(result)
        })

        // delete the doctor 
        app.delete("/doctors/:id", async (req, res) => {
            const id = req.params.id;
            const query = ({ _id: ObjectId(id) })
            const result = await doctorCollection.deleteOne(query)
            res.send(result)
        })



    }
    finally { }
}

run().catch(console.dir)


app.get('/', (req, res) => {
    res.send("Doctors portal")
})

app.listen(port, () => {
    console.log("doctors treatment")
})