const mongoose = require('mongoose')

const postSchema = new mongoose.Schema({
    owner: {type: mongoose.Schema.Types.ObjectId, ref:'User'},
    title: {type: String, required: true},
    photos: [String],
    description: {type: String, required: true},
    price: {type: Number, required: true},
    features: [String]
})

const PostModel = mongoose.model('Post', postSchema)

module.exports = PostModel