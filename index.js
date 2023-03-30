require('dotenv').config()
const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const fs = require('fs')
const multer = require('multer')
const {S3Client, PutObjectCommand} = require('@aws-sdk/client-s3')

const User = require('./models/UserModel.js')
const Post = require('./models/PostModel.js')
const Booking = require('./models/BookingModel.js')

const app = express()
const bucketName = 'pmish-car-rentals'



app.use(cors({
    //tells browser to include cookes and auth in the request 
    //if false, browser will not send cookies or auth info with request 
    credentials: true,
    //specifies the domains which are allowed to access the server 
    // origin: 'http://localhost:5173'

    origin: "https://main--gorgeous-yeot-dafbca.netlify.app"
}))
app.use(express.json())
app.use(cookieParser())


const uploadToS3 = async (path, originalFilename, mimetype) => {
    const client = new S3Client({
        region: process.env.S3_DEFAULT_REGION,
        credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        }
    })
    const parts  = originalFilename.split('.')
    const ext = parts[parts.length-1]
    const newFilename = Date.now() + '.' + ext

    try {
        await client.send(new PutObjectCommand({
            Bucket: bucketName,
            Body: fs.readFileSync(path),
            Key: newFilename,
            ContentType: mimetype,
            ACL: 'public-read'
        }))
        
        return `https://${bucketName}.s3.amazonaws.com/${newFilename}`
    } catch (error) {
        console.log(error)
    }

}


//------REGISTER-------
app.post('/api/register', async (req, res) => {
    mongoose.connect(process.env.MONGODB_URL)
    const {name, email, password} = req.body
    const hash = bcrypt.hashSync(password, 10)

    try {
        const createdUser = await User.create({name, email, password: hash})
        res.json(createdUser)
    } catch {
        console.log(error)
    }
})

//------LOGIN-------
app.post('/api/login', async (req, res) => {
    mongoose.connect(process.env.MONGODB_URL)
    const email = req.body.email
    const password = req.body.password
    try {
        const foundUser = await User.findOne({email})
        if (foundUser) {
            const hash = foundUser.password
            if (bcrypt.compareSync(password, hash)) {
                jwt.sign({id: foundUser._id}, process.env.JWT_PRIVATE_KEY, {}, (err, token) => {
                    if (err) throw err
                    res.cookie('token', token, {secure: true, sameSite: 'none'}).json(foundUser)
                })
            } else (
                res.status(401).json('wrong password')
            )
        } else {
            res.status(404).json('user not found')
        }
    } catch (error) {
        console.log(error)
    }
})

//------LOGOUT-------
app.get('/api/logout', (req, res) => {
    res.cookie('token', "").json(true)
})

//------GET PROFILE-------
app.get('/api/profile', (req, res) => {
    mongoose.connect(process.env.MONGODB_URL)
    const {token} = req.cookies
    if (token) {
        jwt.verify(token, process.env.JWT_PRIVATE_KEY, async (err, decoded) => {
            if (err) throw err
            const {id} = decoded
            try {
                const user = await User.findById(id)
                res.json(user)
            } catch (error) {
                console.log(error)
            }
        })
    } else {
        res.json("")
    }
})

//------CREATE POST-------
app.post('/api/create', async (req, res) => {
    mongoose.connect(process.env.MONGODB_URL)
    const {token} = req.cookies 
    const {
        title, 
        photos, 
        description, 
        price,
        features
    } = req.body

    if (token) {
        jwt.verify(token, process.env.JWT_PRIVATE_KEY, async (err, decoded) => {
            if (err) throw err
            const {id} = decoded 
            try {
                const createdPost = await Post.create({
                    owner: id,
                    title, 
                    photos, 
                    description, 
                    price,
                    features
                })
                res.json(createdPost)
            } catch (error) {
                console.error(error)
            }
        })
    }


})
//------UPDATE POST-------
app.put('/api/update', async (req, res) => {
    mongoose.connect(process.env.MONGODB_URL)
    const {
        title, 
        photos, 
        description, 
        price, 
        features, 
        id
    } = req.body
    try {
        const updateDoc = await Post.findByIdAndUpdate({_id: id}, {$set: {
            title, 
            photos, 
            description, 
            price, 
            features
        }}, {new: true})
        await updateDoc.save()
        res.json(updateDoc)
    } catch (error) {
        console.log(error)
    }
})



//------UPLOAD IMAGES-------
//req.files will be empty without multer
const photosMiddleware = multer({dest: '/tmp'}) 
app.post('/api/upload', photosMiddleware.array('photos', 100), async (req, res) => {
    console.log(req.files)
    const uploadedFiles = []
    for (let i = 0; i < req.files.length; i++) {
        const {path, originalname, mimetype} = req.files[i]
        const url = await uploadToS3(path, originalname, mimetype)
        uploadedFiles.push(url)
    }
    res.json(uploadedFiles)
})

//------GET USER's POSTS-------
app.get('/api/user-posts/:id', async (req, res) => {
    mongoose.connect(process.env.MONGODB_URL)
    const {id} = req.params
    try {
        const userPosts = await Post.find({owner: id})
        res.json(userPosts)
    } catch (error) {
        console.log(error)
    }
})

//------GET ALL POSTS-------
app.get('/api/posts', async (req, res) => {
    mongoose.connect(process.env.MONGODB_URL)
    try {
        const posts = await Post.find()
        res.json(posts)
    } catch (error) {
        console.log(error)
    }
})



//------GET A POST-------
app.get('/api/post/:id', async (req, res) => {
    mongoose.connect(process.env.MONGODB_URL)
    const {id} = req.params
    try {
        const postDoc = await Post.findById(id)
        res.json(postDoc)
    } catch (error) {
        console.log(error)
    }
})


//------CREATE BOOKING-------
app.post('/api/booking', async (req, res) => {
    mongoose.connect(process.env.MONGODB_URL)
    const {
        name, 
        phone, 
        pickUp, 
        dropOff,
        total, 
        post, 
        bookerId
    } = req.body
    try {
        const createdBooking = await Booking.create({
            name, 
            phone, 
            pickUp, 
            dropOff, 
            post, 
            bookerId,
            total
        })
        res.json(createdBooking)
    } catch (error) {
        console.log(error)
    }
})

//------GET BOOKINGS-------
app.get('/api/bookings/:id', async (req, res) => {
    mongoose.connect(process.env.MONGODB_URL)
    const {id} = req.params
    try {
        const bookingsDoc = await Booking.find({bookerId: id}).populate('post bookerId')
        res.json(bookingsDoc)
    } catch (error) {
        console.log(error)
    }
})


//------DELETE-------
app.delete('/api/delete/:id', async (req, res) => {
    mongoose.connect(process.env.MONGODB_URL)
    const {id} = req.params
    try {
        const deletedDoc = await Post.findByIdAndDelete(id)
        res.json(deletedDoc)
    } catch (error) {
        console.log(error)
    }
})

// app.use(express.static(__dirname.replace('server', 'client') + '/build'))

// app.get('*', (req, res) => {
//     res.sendFile(__dirname.replace('server', 'client') + '/build/index.html')
// })

app.listen(process.env.PORT || 4000, () => console.log('on port 4000'))


//BB1yicxvtw8eU54C