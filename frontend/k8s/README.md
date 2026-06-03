# K8s Skeleton

Build and load the image:

```bash
docker build -t employee-frontend:latest .
```

Apply the manifests:

```bash
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

For a remote registry, replace `employee-frontend:latest` in `deployment.yaml` with your pushed image name. If the backend services move behind an API gateway, update `configmap.yaml` or add service-specific environment variables in the cluster.
