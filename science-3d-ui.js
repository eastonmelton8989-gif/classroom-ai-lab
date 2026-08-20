// EduLabs AI Science Lab 3D UI
let generatedModelUrl = null;

const threeButton = document.getElementById('generate3d');
const downloadButton = document.getElementById('download3d');

async function generateReal3D(){
  const input=document.getElementById('file');
  const status=document.getElementById('status');
  if(!input.files[0]){status.textContent='Upload a science diagram first.';return;}

  status.textContent='Sending diagram to AI 3D generator...';
  const data=new FormData();
  data.append('image',input.files[0]);

  try{
    const response=await fetch('/api/generate-3d',{method:'POST',body:data});
    const result=await response.json();
    if(!result.modelUrl) throw new Error(result.error||'No model returned');
    generatedModelUrl=result.modelUrl;
    window.loadScienceModel(result.modelUrl);
    downloadButton.hidden=false;
    status.textContent='3D model generated successfully.';
  }catch(error){
    status.textContent='3D generation is not connected yet: '+error.message;
  }
}

threeButton?.addEventListener('click',generateReal3D);
downloadButton?.addEventListener('click',()=>{
 if(generatedModelUrl) downloadButton.href=generatedModelUrl;
});
