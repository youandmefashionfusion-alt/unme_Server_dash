const mongoose =require("mongoose");

var historySchema = new mongoose.Schema(
    {
    name:{
        type: String,
      },
    title: {
        type: String,
        },
    sku:{
        type:String,
       
        },
    productchange:{
        type:String,
        },
        time:{
            type:Date,
        }
  });
const HistoryModel =mongoose.models.History || mongoose.model("History", historySchema);

export default HistoryModel;