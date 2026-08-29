#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
K8S_DIR="$ROOT_DIR/k8s"
NAMESPACE="oj"
CLUSTER_NAME="kind"

echo "========================================="
echo "Deploying Online Judge Platform"
echo "Repository: $ROOT_DIR"
echo "K8s Dir:    $K8S_DIR"
echo "========================================="

cd "$ROOT_DIR"

echo
echo "[0/8] Loading execution images into Kind..."

docker context use default
docker pull gcc:15
docker pull python:3.9
docker pull node:18
docker pull eclipse-temurin:17-jdk

for node in kind-control-plane kind-worker kind-worker2
do
  docker exec "$node" \
    ctr -n k8s.io images pull docker.io/library/gcc:latest
done

echo
echo "[1/7] Namespace, Secrets, RBAC"

kubectl apply -f "$K8S_DIR/namespace.yml"
kubectl apply -f "$K8S_DIR/secrets.yml"
kubectl apply -f "$K8S_DIR/rbac.yaml"

echo
echo "[2/7] Redis"

kubectl apply -f "$K8S_DIR/redis/"

echo
echo "[3/7] PostgreSQL"

kubectl apply -f "$K8S_DIR/postgres/postgres-pv.yml"
kubectl apply -f "$K8S_DIR/postgres/postgres-pvc.yml"
kubectl apply -f "$K8S_DIR/postgres/postgres-service.yml"
kubectl apply -f "$K8S_DIR/postgres/postgres-deployment.yml"

echo
echo "Waiting for PostgreSQL..."

kubectl rollout status deployment/postgres-deployment --timeout=300s -n $NAMESPACE

echo
echo "[4/7] Database Migration"

kubectl delete job prisma-migrate-seed \
  --ignore-not-found=true -n $NAMESPACE

kubectl apply -f "$K8S_DIR/postgres/postgres-migrate-seed.yml"

kubectl wait \
  --for=condition=complete \
  job/prisma-migrate-seed \
  --timeout=300s -n $NAMESPACE

echo
echo "[5/7] Backend Services"

BACKEND_SERVICES=(
  auth
  users
  tags
  companies
  problems
  submissions
  execution
)

for service in "${BACKEND_SERVICES[@]}"
do
  echo "Deploying $service..."
  kubectl apply -f "$K8S_DIR/apps/$service/"
done

echo
echo "[6/7] API Gateway"

kubectl apply -f "$K8S_DIR/apps/api-gateway/"

echo
echo "[7/7] Client"

kubectl apply -f "$K8S_DIR/apps/client/"

echo
echo "Waiting for deployments..."

DEPLOYMENTS=(
  auth-deployment
  users-deployment
  tags-deployment
  companies-deployment
  problems-deployment
  submissions-deployment
  execution-deployment
  api-gateway-deployment
  client-deployment
)

for deployment in "${DEPLOYMENTS[@]}"
do
  echo "Waiting for deployment/$deployment ..."
  kubectl rollout status deployment/"$deployment" --timeout=300s -n $NAMESPACE
done

echo
echo "========================================="
echo "Deployment Successful"
echo "========================================="

echo
echo "Pods"
kubectl get pods -o wide -n $NAMESPACE

echo
echo "Services"
kubectl get svc -n $NAMESPACE

echo
echo "Deployments"
kubectl get deployments -n $NAMESPACE
