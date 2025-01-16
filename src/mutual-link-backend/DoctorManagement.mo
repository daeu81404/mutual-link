import Principal "mo:base/Principal";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Result "mo:base/Result";
import Nat "mo:base/Nat";
import Hash "mo:base/Hash";
import Array "mo:base/Array";

module {
    public type Doctor = {
        id: Nat;
        name: Text;
        email: Text;
        phone: Text;
        hospital: Text;
        department: Text;
        role: Text;
        publicKey: ?Text;
    };

    public class DoctorManager() {
        private var doctors = HashMap.HashMap<Nat, Doctor>(1, Nat.equal, Hash.hash);
        private var nextId : Nat = 1;

        public func updateDoctor(doctor: Doctor) : Result.Result<Doctor, Text> {
            let id = if (doctor.id == 0) {
                let id = nextId;
                nextId += 1;
                id;
            } else {
                doctor.id
            };

            let newDoctor = {
                id = id;
                name = doctor.name;
                email = doctor.email;
                phone = doctor.phone;
                hospital = doctor.hospital;
                department = doctor.department;
                role = doctor.role;
                publicKey = doctor.publicKey;
            };

            doctors.put(id, newDoctor);
            #ok(newDoctor)
        };

        public func deleteDoctor(id: Nat) : Result.Result<(), Text> {
            switch (doctors.remove(id)) {
                case (null) { #err("해당 ID의 의사를 찾을 수 없습니다.") };
                case (?_) { #ok(()) };
            }
        };

        public func getAllDoctors() : [Doctor] {
            Iter.toArray(doctors.vals())
        };

        public func getDoctor(id: Nat) : ?Doctor {
            doctors.get(id)
        };

        public func getDoctorByEmail(email: Text) : ?Doctor {
            let doctorsArray = Iter.toArray(doctors.vals());
            Array.find<Doctor>(doctorsArray, func(doc: Doctor) : Bool {
                doc.email == email
            })
        };

        public func updateDoctorPublicKey(email: Text, publicKey: Text) : Result.Result<Doctor, Text> {
            let doctorOpt = getDoctorByEmail(email);
            
            switch (doctorOpt) {
                case (null) { #err("해당 이메일의 의사를 찾을 수 없습니다.") };
                case (?doctor) {
                    switch (doctor.publicKey) {
                        case (?existingKey) { 
                            if (existingKey == publicKey) {
                                #ok(doctor) // 이미 같은 public key가 등록되어 있으면 그대로 반환
                            } else {
                                #err("이미 다른 public key가 등록되어 있습니다.")
                            }
                        };
                        case (null) {
                            let updatedDoctor = {
                                id = doctor.id;
                                name = doctor.name;
                                email = doctor.email;
                                phone = doctor.phone;
                                hospital = doctor.hospital;
                                department = doctor.department;
                                role = doctor.role;
                                publicKey = ?publicKey;
                            };
                            doctors.put(doctor.id, updatedDoctor);
                            #ok(updatedDoctor)
                        };
                    }
                };
            }
        };
    };
};