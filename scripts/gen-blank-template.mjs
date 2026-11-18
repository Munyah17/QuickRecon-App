import ExcelJS from "exceljs";
import { writeFileSync } from "node:fs";

const SHEETS = [
  "Dashboard","Summary","Insurance","ZINARA","NMB","NBS","CBZ","STEWARD",
  "USD Deposits","Transfers & Ecocash","Alterations","Closing Variance",
];

const COLUMNS = {
  Summary: [
    "Agent Name","Opening Variance","Insurance","Premium Cover","Commission",
    "Net Insurance","ZINARA","Insurance PDS","ZINARA PDS","Total Expected",
    "CBZ","NBS","NMB","STEWARD","USD Deposits","Transfers & Ecocash","Alterations","Closing Variance",
  ],
};

const NAVY="FF0F2B4C", GREY="FF6B7280", BORDER="FFE5E7EB";
const thin={style:"thin",color:{argb:BORDER}};
const box={top:thin,left:thin,bottom:thin,right:thin};
const fill=(a)=>({type:"pattern",pattern:"solid",fgColor:{argb:a}});

function styleHeaderRow(ws,r){
  ws.getRow(r).eachCell((c)=>{
    c.font={bold:true,size:10,color:{argb:"FFFFFFFF"}};
    c.fill=fill(NAVY); c.border=box; c.alignment={vertical:"middle",wrapText:true};
  });
  ws.getRow(r).height=28;
}

function buildDashboard(ws){
  ws.views=[{showGridLines:false}];
  ws.columns=Array.from({length:12},(_,i)=>({width:i===0?2:13}));
  ws.mergeCells("B2:K2");
  const t=ws.getCell("B2");
  t.value="QUICKRECON — CONSOLIDATED REVENUE REPORT";
  t.font={bold:true,size:16,color:{argb:"FFFFFFFF"}};
  t.alignment={vertical:"middle",horizontal:"center"};
  ws.getRow(2).height=34;
  for(let c=2;c<=11;c++) ws.getCell(2,c).fill=fill(NAVY);
  ws.mergeCells("B3:K3");
  const s=ws.getCell("B3");
  s.value="Agent Name  ·  Module  ·  Period";
  s.font={size:11,color:{argb:GREY}};
  s.alignment={vertical:"middle",horizontal:"center"};
  ws.getRow(3).height=20;
  ws.mergeCells("B5:K5");
  const st=ws.getCell("B5");
  st.value="RECONCILED";
  st.font={bold:true,size:11,color:{argb:"FF16A34A"}};
  st.alignment={vertical:"middle",horizontal:"center"};
  ws.getRow(5).height=24;
  for(let c=2;c<=11;c++){ws.getCell(5,c).fill=fill("FFF0FDF4");ws.getCell(5,c).border=box;}
  const kpis=[
    ["Insurance","Premium Cover"],["Commission","Net Insurance"],
    ["ZINARA","Insurance PDS"],["ZINARA PDS","Total Expected"],
    ["CBZ","NBS"],["NMB","STEWARD"],
    ["USD Deposits","Transfers & Ecocash"],["Alterations","Opening Variance"],
    ["Closing Variance","Total Deposits"],
  ];
  let row=7;
  for(const pair of kpis){
    for(let j=0;j<2;j++){
      const col=2+j*5, label=pair[j];
      const lc=ws.getCell(row,col);
      lc.value=label.toUpperCase();
      lc.font={size:9,bold:true,color:{argb:GREY}};
      lc.alignment={horizontal:"center",vertical:"middle"};
      lc.fill=fill("FFF9FAFB"); lc.border=box;
      const vc=ws.getCell(row+1,col);
      vc.value=""; vc.numFmt="#,##0.00";
      vc.font={size:14,bold:true,color:{argb:NAVY}};
      vc.alignment={horizontal:"center",vertical:"middle"};
      vc.fill=fill("FFF9FAFB"); vc.border=box;
      ws.mergeCells(row,col,row,col+3);
      ws.mergeCells(row+1,col,row+1,col+3);
    }
    ws.getRow(row).height=17; ws.getRow(row+1).height=28; row+=3;
  }
}

const wb=new ExcelJS.Workbook();
wb.creator="QuickRecon App"; wb.created=new Date();
for(const name of SHEETS){
  const ws=wb.addWorksheet(name);
  if(name==="Dashboard"){buildDashboard(ws);continue;}
  const cols=COLUMNS[name];
  if(cols){
    ws.addRow(cols); styleHeaderRow(ws,1); ws.addRow([]); ws.addRow([]);
    ws.columns.forEach((c,i)=>(c.width=i===0?24:14));
  }else{
    ws.getCell("A1").value=`${name} — columns TBD`;
    ws.getCell("A1").font={bold:true,size:12};
    ws.columns=[{width:30}];
  }
}
const buf=await wb.xlsx.writeBuffer();
writeFileSync("recon-template-v3.xlsx",Buffer.from(buf));
console.log("Wrote recon-template-v3.xlsx with",SHEETS.length,"sheets.");


