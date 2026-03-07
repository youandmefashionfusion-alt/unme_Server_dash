const mongoose = require("mongoose")
const bannerSchema = new mongoose.Schema({
    mobileBanners: [
        {
            url: {
                type: String,
                required: true
            },
            title: {
                type: String,
                default: ""
            },
            subtitle: {
                type: String,
                default: ""
            },
            link: {
                type: String,
                default: ""
            },
        },
    ],
    budgetBanners: [
        {
            url: {
                type: String,
                required: true
            },
            title: {
                type: String,
                default: ""
            },
            subtitle: {
                type: String,
                default: ""
            },
            link: {
                type: String,
                default: ""
            },
        },
    ],
    otherBanners: [
        {
            url: {
                type: String,
                required: true
            },
            title: {
                type: String,
                default: ""
            },
            subtitle: {
                type: String,
                default: ""
            },
            link: {
                type: String,
                default: ""
            },
        },
    ],
    desktopBanners: [
        {
            url: {
                type: String,
                required: true
            },
            title: {
                type: String,
                default: ""
            },
            subtitle: {
                type: String,
                default: ""
            },
            link: {
                type: String,
                default: ""
            },
        },
    ],

}, {
    timestamps: true
})

const BannerModel = mongoose.models.Banner || mongoose.model("Banner", bannerSchema);
export default BannerModel;