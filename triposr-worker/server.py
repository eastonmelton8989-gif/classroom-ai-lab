from flask import Flask, request, jsonify
import os
import uuid

app = Flask(__name__)

@app.post('/generate')
def generate():
    if 'image' not in request.files:
        return jsonify({'error':'missing image'}), 400

    image = request.files['image']
    job = str(uuid.uuid4())
    os.makedirs('uploads', exist_ok=True)
    path = f'uploads/{job}.png'
    image.save(path)

    # Connect this section to your local TripoSR inference command.
    # The result should be a generated .glb file.
    model = f'models/{job}.glb'

    if not os.path.exists(model):
        return jsonify({'status':'waiting_for_triposr','job':job})

    return jsonify({'modelUrl':model})

app.run(host='0.0.0.0', port=8000)
