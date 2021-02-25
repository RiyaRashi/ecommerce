const deleteProduct = (btn) => {
    //console.log(btn);
    const prodId = btn.parentNode.querySelector('[name=productId]').value;
    const csrf = btn.parentNode.querySelector('[name=_csrf]').value;
    const productELement = btn.closest('article');//delete krne ke lie

    fetch('/admin/product/' + prodId, {
        method: "DELETE",
        headers: {
            'csrf-token': csrf
        }


    }).then(result => {
        //console.log(result);
        return result.json();
    }).then(data => {
        //console.log(data);
        console.log(productELement);
        productELement.parentNode.removeChild(productELement);
    })
        .catch(err => {
            console.log(err);
        });


};
