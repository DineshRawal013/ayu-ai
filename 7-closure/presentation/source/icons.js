const React=require('react'),RDS=require('react-dom/server'),sharp=require('sharp');
const fa=require('react-icons/fa');
module.exports=async function icon(name,color){const C=fa[name]; if(!C) throw new Error('no icon '+name);
 const svg=RDS.renderToStaticMarkup(React.createElement(C,{color:'#'+color,size:256}));
 const buf=await sharp(Buffer.from(svg)).png().toBuffer(); return 'image/png;base64,'+buf.toString('base64');};
