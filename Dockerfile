FROM node:20-bookworm-slim

# تثبيت أدوات النظام المطلوب وجودها
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    openssh-client \
    ca-certificates \
    chromium \
    && rm -rf /var/lib/apt/lists/*

# إعادة توجيه شاملة قبل أي عملية تثبيت (تغطي ssh و git و git+ssh بنفس الوقت)
RUN git config --global url."https://github.com/".insteadOf ssh://git@github.com/ && \
    git config --global url."https://github.com/".insteadOf git@github.com: && \
    git config --global url."https://github.com/".insteadOf git://github.com/ && \
    git config --global url."https://github.com/".insteadOf git+ssh://git@github.com/

WORKDIR /app

COPY package*.json ./

# أمر تثبيت يجبر npm على عدم استخدام SSH مطلقاً
RUN npm config set git-tag-version false && \
    npm install --omit=dev --legacy-peer-deps

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
