FROM python:3.11

RUN apt-get update && apt-get install -y python3-dev gcc && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH"

WORKDIR /app

COPY --chown=user ./requirements.txt requirements.txt
RUN pip install --no-cache-dir --upgrade pip setuptools wheel
RUN pip install --no-cache-dir flask==3.0.0 flask-cors==4.0.0 requests==2.31.0 python-dotenv==1.0.0 gunicorn==21.2.0 cryptography==41.0.0 opencv-python-headless==4.9.0.80 Pillow==10.4.0 "numpy<2.0.0" ImageHash==4.3.1 onnxruntime tensorflow-cpu easyocr
RUN pip install --no-cache-dir web3==6.15.1 --no-deps
RUN pip install --no-cache-dir eth-abi eth-account eth-hash eth-typing eth-utils hexbytes jsonschema lru-dict protobuf typing-extensions websockets pyunormalize aiohttp

COPY --chown=user . /app

EXPOSE 7860

CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:7860", "--timeout", "120", "--workers", "1"]