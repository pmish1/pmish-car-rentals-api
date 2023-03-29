const mongoose = require('mongoose')

const bookingSchema = new mongoose.Schema({
    post: {type: mongoose.Schema.Types.ObjectId, ref:'Post'},
    bookerId: {type: mongoose.Schema.Types.ObjectId, ref:'User'},
    name: {type: String, required: true},
    phone: {type: Number, required: true},
    pickUp: {type: Date, required: true},
    dropOff: {type: Date, required: true},
    total: {type: Number, requried: true}
})

const BookingModel = mongoose.model('Booking', bookingSchema)

module.exports = BookingModel