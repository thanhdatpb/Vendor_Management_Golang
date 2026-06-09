const fs = require('fs');
let data = fs.readFileSync('db.json', 'utf8');

// Replace normal JSON
data = data.replace(/Seller "[^"]+" thuộc Project "([^"]+)" vừa gửi form request mới\./g, 'Seller của project $1 vừa gửi form request mới.');

// Replace stringified JSON where quotes are escaped with \\\"
data = data.replace(/Seller \\\\\\"[^\\\\]+\\\\\\" thuộc Project \\\\\\"([^\\\\]+)\\\\\\" vừa gửi form request mới\\\./g, 'Seller của project $1 vừa gửi form request mới.');

fs.writeFileSync('db.json', data);
console.log('Fixed db.json stringified JSON');
