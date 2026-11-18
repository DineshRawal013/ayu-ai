FROM nginx:1.27-alpine

RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf
# nginx.conf is a template: the image's entrypoint writes it to conf.d with GATEWAY_URL filled in.
# The filter keeps nginx's own $variables untouched.
COPY nginx.conf /etc/nginx/templates/ayu.conf.template
ENV GATEWAY_URL=http://gateway:3000 \
    NGINX_ENVSUBST_FILTER=GATEWAY_URL
COPY index.html style.css app.js kundali.js /usr/share/nginx/html/

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]
