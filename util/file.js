const fs=require('fs');
const deleteFile=(filePath)=>{
    fs.unlink(filePath,(err)=>{
        if(err){
                throw (err);
        }
    });
}

exports.deleteFile=deleteFile;
//deleting image when product deletd and when image replaced by other image while editing