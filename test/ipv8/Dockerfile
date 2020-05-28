FROM python:3.7-slim as ipv8
WORKDIR /usr/src/app

# Libsodium is not installed by default but required for IPv8
RUN apt-get update
RUN apt-get install libsodium-dev git gcc --yes
RUN git clone --depth=50 --branch=master https://github.com/Tribler/py-ipv8.git pyipv8
RUN pip install --no-cache-dir -r ./pyipv8/requirements.txt
RUN pip install requests

RUN touch __init__.py
COPY . .

CMD ["python", "main.py"]
HEALTHCHECK --interval=1s --timeout=5s --start-period=120s --retries=3 CMD [ "python", "healthcheck.py" ]
